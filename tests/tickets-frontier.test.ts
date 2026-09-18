import { expect, test } from 'vitest';
import { calculateFrontier, createMemoryAdapter, decodeApplyRequest, parseId, prepareApply, prepareCreate } from '../src/index.js';
import type { ApplyRequest, Command, NonEmpty, StateAdapter, StoredMapState, StoredTicket } from '../src/index.js';
import { createMemoryAdapterWithFault } from '../src/memory-adapter.js';

function id<K extends string>(kind: K, value: string) {
  const result = parseId(kind, value);
  if (result.kind !== 'ok') throw new Error('Invalid fixture ID');
  return result.value;
}
const mapId = id('Map', 'Alpha');
const otherId = id('Map', 'Other');
const author = { actorId: id('Actor', 'kun'), clientId: id('Client', 'codex'), occurredAt: '2026-09-18T04:00:00Z' };
async function setup() {
  const adapter = createMemoryAdapter();
  for (const identity of [mapId, otherId]) {
    const prepared = prepareCreate({ id: identity, title: 'Plan', destination: 'Arrive', author });
    if (prepared.kind !== 'ok') throw new Error('Expected create preparation');
    await adapter.commit(prepared.value);
  }
  return adapter;
}
async function current(adapter: StateAdapter, identity = mapId): Promise<StoredMapState> {
  const read = await adapter.readCurrent(identity);
  if (read.kind !== 'found') throw new Error('Expected current Map');
  return read.value;
}
function request(commands: NonEmpty<Command>, expectedRevision = 1): ApplyRequest {
  return { mapId, expectedRevision, author, commands };
}
async function observe(adapter: StateAdapter, head = 1) {
  return structuredClone(await Promise.all([mapId, otherId, id('Map', 'Missing')].map(async (identity) => ({
    current: await adapter.readCurrent(identity),
    history: await Promise.all(Array.from({ length: head + 1 }, (_, i) => adapter.readRevision(identity, i + 1))),
  }))));
}

test('T01/T02/G06: four Ticket types start open and unclaimed; commit returns exact ASCII Frontier and full history', async () => {
  const adapter = await setup();
  const first = await adapter.readRevision(mapId, 1);
  const unrelated = await adapter.readRevision(otherId, 1);
  const initial = await current(adapter);
  const tickets = (['grilling', 'prototype', 'research', 'task'] as const).map((type, i) => ({
    id: id('Ticket', ['z', 'A', 'a', '0'][i]!), title: ` ${type} `, question: ' Why? ', type,
  }));
  const raw = { mapId, expectedRevision: 1, author,
    commands: tickets.map(ticket => ({ kind: 'ticket.create', ticket })) };
  const decoded = decodeApplyRequest(raw);
  expect(decoded.kind).toBe('ok');
  if (decoded.kind !== 'ok') throw new Error('Expected decoded commands');
  const prepared = prepareApply(initial, decoded.value);
  expect(prepared.kind).toBe('prepared');
  if (prepared.kind !== 'prepared') throw new Error('Expected Ticket preparation');
  expect(prepared.frontier).toEqual(['0', 'A', 'a', 'z']);
  const next = { ...initial, currentRevision: 2, tickets: tickets.map(ticket => ({
    ...ticket, extensions: {}, prerequisites: [], status: 'open', claim: null,
  })) };
  const revision = { mapId, revision: 2, priorRevision: 1, kind: 'apply', author,
    changes: tickets.map((ticket, commandIndex) => ({ commandIndex, command: 'ticket.create', subjectId: ticket.id })), state: next };
  expect(await adapter.commit(prepared.change)).toEqual({ kind: 'committed', revision, frontier: ['0', 'A', 'a', 'z'] });
  expect(await adapter.readCurrent(mapId)).toEqual({ kind: 'found', value: next });
  expect(await adapter.readRevision(mapId, 2)).toEqual({ kind: 'found', value: revision });
  expect(await adapter.readRevision(mapId, 1)).toEqual(first);
  expect(await adapter.readRevision(mapId, 3)).toMatchObject({ kind: 'not_found', code: 'revision_not_found' });
  expect(await adapter.readRevision(otherId, 1)).toEqual(unrelated);
});

test('G02/A01: final cycle rejects the whole reachable batch; temporary cycle repaired later in the batch is allowed', async () => {
  const adapter = await setup();
  await commitCommands(adapter, [{ kind: 'ticket.create', ticket: ticket('A') }, { kind: 'ticket.create', ticket: ticket('B') },
    dependency('dependency.add', 'A', 'B')]);
  const before = await observe(adapter, 2);
  expect(prepareApply(await current(adapter), request([{ kind: 'map.update', patch: { title: 'Never publish' } },
    dependency('dependency.add', 'B', 'A')], 2))).toEqual({ kind: 'rejected', rejection: {
    stage: 'final_state', code: 'dependency_cycle', ticketIds: ['A', 'B'],
  } });
  expect(await observe(adapter, 2)).toEqual(before);
  const result = await commitCommands(adapter, [dependency('dependency.add', 'B', 'A'), dependency('dependency.remove', 'A', 'B')]);
  expect(result.frontier).toEqual(['A']);
  expect(result.revision.state.tickets.map(item => ({ id: item.id, prerequisites: item.prerequisites })))
    .toEqual([{ id: 'A', prerequisites: [] }, { id: 'B', prerequisites: ['A'] }]);
});

function storedTicket(value: string, state: 'open' | 'claimed' | 'settled' = 'open', prerequisites: string[] = []): StoredTicket {
  const base = { ...ticket(value), extensions: {}, prerequisites: prerequisites.map(value => id('Ticket', value)) };
  if (state === 'settled') return { ...base, status: 'settled', claim: null,
    settlement: { outcome: { kind: 'completion', statement: 'Accepted completion' }, evidence: [], references: [],
      provenance: { method: 'fixture', sources: [] }, extensions: {}, introducedAtRevision: 1 } };
  return { ...base, status: 'open', claim: state === 'claimed' ? id('Claimant', 'session') : null };
}
test.each([
  { label: 'dangling endpoint', tickets: [storedTicket('A', 'open', ['Missing'])], code: 'dangling_dependency', ids: ['A', 'Missing'] },
  { label: 'settled dependent on open prerequisite', tickets: [storedTicket('A', 'settled', ['B']), storedTicket('B')],
    code: 'settled_ticket_has_open_prerequisite', ids: ['A', 'B'] },
  { label: 'claimed dependent on open prerequisite', tickets: [storedTicket('A', 'claimed', ['B']), storedTicket('B')],
    code: 'claimed_ticket_has_open_prerequisite', ids: ['A', 'B'] },
])('G08/final invariants: public prepareApply defensively rejects $label without publishing or altering the supplied fixture', async ({ tickets, code, ids }) => {
  const adapter = await setup();
  const fixture = { ...await current(adapter), tickets };
  const unchanged = structuredClone(fixture);
  const before = await observe(adapter);
  expect(prepareApply(fixture, request([{ kind: 'map.update', patch: { title: 'Never publish' } }]))).toEqual({
    kind: 'rejected', rejection: { stage: 'final_state', code, ticketIds: ids },
  });
  expect(fixture).toEqual(unchanged);
  expect(await observe(adapter)).toEqual(before);
});

test('G01/G03/G06: settled prerequisites unblock, claimed/settled Tickets are excluded, and settled edges remain in the fixture', async () => {
  const adapter = await setup();
  const fixture = { ...await current(adapter), tickets: [storedTicket('z', 'open', ['B']), storedTicket('A', 'claimed'),
    storedTicket('B', 'settled'), storedTicket('0'), storedTicket('a', 'settled', ['B'])] };
  const initial = structuredClone(fixture);
  expect(calculateFrontier(fixture)).toEqual(['0', 'z']);
  const prepared = prepareApply(fixture, request([{ kind: 'ticket.update', ticketId: id('Ticket', 'z'), patch: { title: 'Next' } }]));
  expect(prepared.kind).toBe('prepared');
  if (prepared.kind !== 'prepared') throw new Error('Expected valid settled fixture');
  expect(prepared.frontier).toEqual(['0', 'z']);
  expect(prepared.change.next.tickets.find(item => item.id === 'a')).toEqual(fixture.tickets[4]);
  expect(fixture).toEqual(initial);
  expect(calculateFrontier({ ...fixture, tickets: [] })).toEqual([]);
});

function ticket(value: string) {
  return { id: id('Ticket', value), title: `Ticket ${value}`, question: 'Why?', type: 'task' as const };
}
async function commitCommands(adapter: StateAdapter, commands: NonEmpty<Command>) {
  const state = await current(adapter);
  const prepared = prepareApply(state, request(commands, state.currentRevision));
  if (prepared.kind !== 'prepared') throw new Error(`Expected preparation: ${JSON.stringify(prepared)}`);
  const committed = await adapter.commit(prepared.change);
  if (committed.kind !== 'committed') throw new Error('Expected commit');
  return committed;
}
test('T01: update open Ticket replaces supplied fields, preserves identity and replaces Extensions as a whole', async () => {
  const adapter = await setup();
  await commitCommands(adapter, [{ kind: 'ticket.create', ticket: { ...ticket('A'), extensions: { 'app.old': 1, 'app.keep': 2 } } }]);
  const old = await adapter.readRevision(mapId, 2);
  const committed = await commitCommands(adapter, [{ kind: 'ticket.update', ticketId: id('Ticket', 'A'),
    patch: { title: ' New ', question: ' Next? ', type: 'research', extensions: { 'app.new': { nested: [true] } } } }]);
  expect(committed.revision.state.tickets).toEqual([{ id: 'A', title: ' New ', question: ' Next? ', type: 'research',
    extensions: { 'app.new': { nested: [true] } }, prerequisites: [], status: 'open', claim: null }]);
  expect(committed.revision.changes).toEqual([{ commandIndex: 0, command: 'ticket.update', subjectId: 'A' }]);
  expect(committed.frontier).toEqual(['A']);
  expect(await adapter.readRevision(mapId, 2)).toEqual(old);
});

test.each([
  { label: 'duplicate Ticket', code: 'ticket_already_exists', command: { kind: 'ticket.create', ticket: ticket('A') } },
  { label: 'missing update target', code: 'ticket_not_found', command: { kind: 'ticket.update', ticketId: 'Missing', patch: { title: 'Next' } } },
])('A03: $label rejects at its command position and preserves all known Maps/history', async ({ code, command }) => {
  const adapter = await setup();
  await commitCommands(adapter, [{ kind: 'ticket.create', ticket: ticket('A') }]);
  const before = await observe(adapter, 2);
  const prepared = prepareApply(await current(adapter), request([
    { kind: 'map.update', patch: { title: 'Never publish' } }, command as unknown as Command,
  ], 2));
  expect(prepared).toEqual({ kind: 'rejected', rejection: { stage: 'command', commandIndex: 1, code,
    ticketIds: [code === 'ticket_not_found' ? 'Missing' : 'A'] } });
  expect(await observe(adapter, 2)).toEqual(before);
});

function dependency(kind: 'dependency.add' | 'dependency.remove', dependent: string, prerequisite: string): Command {
  return { kind, dependentId: id('Ticket', dependent), prerequisiteId: id('Ticket', prerequisite) };
}
test('G01/G03/A06: local AND Dependencies block on either open prerequisite; removing the last unmet edge unlocks', async () => {
  const adapter = await setup();
  const first = await adapter.readRevision(mapId, 1);
  const unrelated = await adapter.readRevision(otherId, 1);
  const initial = await current(adapter);
  const created = await commitCommands(adapter, [
    ...['A', 'B', 'C'].map(value => ({ kind: 'ticket.create' as const, ticket: ticket(value) })),
    dependency('dependency.add', 'A', 'B'), dependency('dependency.add', 'A', 'C'),
  ] as unknown as NonEmpty<Command>);
  const storedTickets = ['A', 'B', 'C'].map(value => ({ ...ticket(value), extensions: {}, status: 'open', claim: null,
    prerequisites: value === 'A' ? ['B', 'C'] : [] }));
  expect(created.revision.state).toEqual({ ...initial, currentRevision: 2, tickets: storedTickets });
  expect(created.frontier).toEqual(['B', 'C']);
  expect(created.revision.changes).toEqual([
    { commandIndex: 0, command: 'ticket.create', subjectId: 'A' },
    { commandIndex: 1, command: 'ticket.create', subjectId: 'B' },
    { commandIndex: 2, command: 'ticket.create', subjectId: 'C' },
    { commandIndex: 3, command: 'dependency.add', subjectId: 'A' },
    { commandIndex: 4, command: 'dependency.add', subjectId: 'A' },
  ]);
  const removedOne = await commitCommands(adapter, [dependency('dependency.remove', 'A', 'B')]);
  expect(removedOne.frontier).toEqual(['B', 'C']);
  expect(removedOne.revision.state).toEqual({ ...initial, currentRevision: 3,
    tickets: storedTickets.map(item => item.id === 'A' ? { ...item, prerequisites: ['C'] } : item) });
  const removedLast = await commitCommands(adapter, [dependency('dependency.remove', 'A', 'C')]);
  expect(removedLast.frontier).toEqual(['A', 'B', 'C']);
  expect(removedLast.revision.state).toEqual({ ...initial, currentRevision: 4,
    tickets: storedTickets.map(item => ({ ...item, prerequisites: [] })) });
  for (const result of [created, removedOne, removedLast]) {
    expect(await adapter.readRevision(mapId, result.revision.revision)).toEqual({ kind: 'found', value: result.revision });
  }
  expect(await adapter.readRevision(mapId, 1)).toEqual(first);
  expect(await adapter.readRevision(mapId, 5)).toMatchObject({ kind: 'not_found', code: 'revision_not_found' });
  expect(await adapter.readRevision(otherId, 1)).toEqual(unrelated);
});

const invalidCommands: { label: string; command: unknown; path: (string | number)[] }[] = [
  { label: 'missing Ticket', command: { kind: 'ticket.create' }, path: ['ticket'] },
  { label: 'nonplain Ticket', command: { kind: 'ticket.create', ticket: [] }, path: ['ticket'] },
  ...(['id', 'title', 'question', 'type'] as const).map(key => ({ label: `missing create ${key}`,
    command: { kind: 'ticket.create', ticket: { ...ticket('A'), [key]: undefined } }, path: ['ticket', key] })),
  ...(['title', 'question'] as const).flatMap(key => [
    { label: `blank create ${key}`, command: { kind: 'ticket.create', ticket: { ...ticket('A'), [key]: '\n\t ' } }, path: ['ticket', key] },
    { label: `blank update ${key}`, command: { kind: 'ticket.update', ticketId: 'A', patch: { [key]: ' ' } }, path: ['patch', key] },
  ]),
  ...(['status', 'claim', 'settlement', 'prerequisites', 'introducedAtRevision'] as const).flatMap(key => [
    { label: `create forbids ${key}`, command: { kind: 'ticket.create', ticket: { ...ticket('A'), [key]: null } }, path: ['ticket', key] },
    { label: `update forbids ${key}`, command: { kind: 'ticket.update', ticketId: 'A', patch: { [key]: null } }, path: ['patch', key] },
  ]),
  { label: 'update forbids identity patch', command: { kind: 'ticket.update', ticketId: 'A', patch: { id: 'B' } }, path: ['patch', 'id'] },
  { label: 'empty Ticket patch', command: { kind: 'ticket.update', ticketId: 'A', patch: {} }, path: ['patch'] },
  { label: 'unknown Ticket type', command: { kind: 'ticket.update', ticketId: 'A', patch: { type: 'implementation' } }, path: ['patch', 'type'] },
  { label: 'bad create ID', command: { kind: 'ticket.create', ticket: { ...ticket('A'), id: 'bad id' } }, path: ['ticket', 'id'] },
  { label: 'bad update ID', command: { kind: 'ticket.update', ticketId: '', patch: { title: 'Next' } }, path: ['ticketId'] },
  { label: 'missing update target', command: { kind: 'ticket.update', patch: { title: 'Next' } }, path: ['ticketId'] },
  { label: 'missing Ticket patch', command: { kind: 'ticket.update', ticketId: 'A' }, path: ['patch'] },
  { label: 'undefined supplied access', command: { kind: 'ticket.update', ticketId: 'A', patch: { title: 'Next' }, claimantId: undefined }, path: ['claimantId'] },
  { label: 'create forbidden access', command: { kind: 'ticket.create', ticket: ticket('A'), claimantId: 'session' }, path: ['claimantId'] },
  { label: 'unnamespaced Ticket extensions', command: { kind: 'ticket.create', ticket: { ...ticket('A'), extensions: { bad: 1 } } }, path: ['ticket', 'extensions', 'bad'] },
  { label: 'non-JSON Ticket extension', command: { kind: 'ticket.update', ticketId: 'A', patch: { extensions: { 'app.bad': NaN } } }, path: ['patch', 'extensions', 'app.bad'] },
  ...(['dependency.add', 'dependency.remove'] as const).flatMap(kind => [
    { label: `${kind} invalid dependent`, command: { kind, dependentId: 'bad id', prerequisiteId: 'B' }, path: ['dependentId'] },
    { label: `${kind} missing prerequisite`, command: { kind, dependentId: 'A' }, path: ['prerequisiteId'] },
    { label: `${kind} invalid access`, command: { kind, dependentId: 'A', prerequisiteId: 'B', claimantId: '' }, path: ['claimantId'] },
    { label: `${kind} forbidden cross-Map selector`, command: { kind, dependentId: 'A', prerequisiteId: 'B', mapId: 'Other' }, path: ['mapId'] },
  ]),
];
test.each(invalidCommands)('V03/V04/V06/A02: $label fails both raw and typed boundaries before stale checks or command execution', async ({ command, path }) => {
  const adapter = await setup();
  const before = await observe(adapter);
  const raw = { ...request([{ kind: 'map.update', patch: { title: 'Never publish' } }], 99), commands: [
    { kind: 'ticket.create', ticket: ticket('WouldCreate') }, command,
  ] };
  const expectedPath = ['commands', 1, ...path];
  expect(decodeApplyRequest(raw)).toMatchObject({ kind: 'error', error: { code: 'invalid_input', path: expectedPath } });
  expect(prepareApply(await current(adapter), raw as unknown as ApplyRequest)).toMatchObject({ kind: 'rejected', rejection: {
    stage: 'input', error: { code: 'invalid_input', path: expectedPath },
  } });
  expect(await observe(adapter)).toEqual(before);
});

test.each(['ticket.update', 'dependency.add', 'dependency.remove'] as const)('T01/G08: %s requires open dependent and matching access only when already claimed (fixtures, not Claim commands)', async kind => {
  const adapter = await setup();
  const command = kind === 'ticket.update'
    ? { kind, ticketId: id('Ticket', 'A'), patch: { title: 'Next' } }
    : { kind, dependentId: id('Ticket', 'A'), prerequisiteId: id('Ticket', 'B') };
  for (const state of ['settled', 'claimed'] as const) {
    const fixture = { ...await current(adapter), tickets: [storedTicket('A', state, kind === 'dependency.remove' ? ['B'] : []), storedTicket('B', 'settled')] };
    for (const access of [undefined, id('Claimant', 'wrong'), id('Claimant', 'session')]) {
      const before = await observe(adapter);
      const unchanged = structuredClone(fixture);
      const candidate = { ...command, ...(access === undefined ? {} : { claimantId: access }) };
      const prepared = prepareApply(fixture, request([candidate]));
      if (state === 'claimed' && access === 'session') {
        expect(prepared.kind).toBe('prepared');
        if (prepared.kind !== 'prepared') throw new Error('Expected matching fixture access');
        expect(prepared.frontier).toEqual([]);
        expect(prepared.change.next.tickets[0]?.claim).toBe('session');
      } else expect(prepared).toEqual({ kind: 'rejected', rejection: { stage: 'command', commandIndex: 0,
        code: state === 'settled' ? 'ticket_not_open' : access === undefined ? 'claim_required' : 'claim_mismatch', ticketIds: ['A'] } });
      expect(fixture).toEqual(unchanged);
      expect(await observe(adapter)).toEqual(before);
    }
  }
});

test('A01/A03: within-batch duplicate creation fails; adding then removing the same edge is no_changes, with no Revision', async () => {
  const adapter = await setup();
  const before = await observe(adapter);
  expect(prepareApply(await current(adapter), request([{ kind: 'ticket.create', ticket: ticket('A') },
    { kind: 'ticket.create', ticket: ticket('A') }]))).toEqual({ kind: 'rejected', rejection: {
    stage: 'command', commandIndex: 1, code: 'ticket_already_exists', ticketIds: ['A'],
  } });
  expect(await observe(adapter)).toEqual(before);
  await commitCommands(adapter, [{ kind: 'ticket.create', ticket: ticket('A') }, { kind: 'ticket.create', ticket: ticket('B') }]);
  const populated = await observe(adapter, 2);
  expect(prepareApply(await current(adapter), request([dependency('dependency.add', 'A', 'B'), dependency('dependency.remove', 'A', 'B')], 2)))
    .toEqual({ kind: 'rejected', rejection: { stage: 'final_state', code: 'no_changes' } });
  expect(await observe(adapter, 2)).toEqual(populated);
});

test('V03/G01: Ticket identity is unique only inside its Map and prototype-like IDs remain ordinary identities', async () => {
  const adapter = await setup();
  const commands: NonEmpty<Command> = [{ kind: 'ticket.create', ticket: ticket('constructor') },
    { kind: 'ticket.create', ticket: ticket('toString') }, dependency('dependency.add', 'constructor', 'toString')];
  const first = await commitCommands(adapter, commands);
  expect(first.frontier).toEqual(['toString']);
  const other = await current(adapter, otherId);
  const prepared = prepareApply(other, { ...request(commands), mapId: otherId });
  if (prepared.kind !== 'prepared') throw new Error('Expected same local IDs in another Map');
  expect(await adapter.commit(prepared.change)).toMatchObject({ kind: 'committed', frontier: ['toString'] });
  expect(await adapter.readRevision(mapId, 2)).toEqual({ kind: 'found', value: first.revision });
});

test('S04/G06: racing nonempty candidates publish one exact Revision/Frontier, not the losing or a later head', async () => {
  const adapter = await setup();
  const state = await current(adapter);
  const first = await adapter.readRevision(mapId, 1);
  const unrelated = structuredClone(await Promise.all([adapter.readCurrent(otherId), adapter.readRevision(otherId, 1), adapter.readRevision(otherId, 2)]));
  const candidates = ['A', 'z'].map(value => prepareApply(state, request([{ kind: 'ticket.create', ticket: ticket(value) }])));
  if (candidates[0]?.kind !== 'prepared' || candidates[1]?.kind !== 'prepared') throw new Error('Expected race candidates');
  const results = await Promise.all(candidates.map(candidate => {
    if (candidate.kind !== 'prepared') throw new Error('Expected candidate');
    return adapter.commit(candidate.change);
  }));
  const committed = results.filter(result => result.kind === 'committed');
  expect(committed).toHaveLength(1);
  expect(results.filter(result => result.kind === 'conflict')).toEqual([{ kind: 'conflict', conflict: {
    mapId, expectedRevision: 1, currentRevision: 2,
  } }]);
  const winner = committed[0]!;
  const identity = winner.frontier[0]!;
  expect(['A', 'z']).toContain(identity);
  const revision = { mapId, revision: 2, priorRevision: 1, kind: 'apply', author,
    changes: [{ commandIndex: 0, command: 'ticket.create', subjectId: identity }],
    state: { ...state, currentRevision: 2, tickets: [{ ...ticket(identity), extensions: {}, prerequisites: [], status: 'open', claim: null }] } };
  expect(winner).toEqual({ kind: 'committed', revision, frontier: [identity] });
  expect(await adapter.readCurrent(mapId)).toEqual({ kind: 'found', value: revision.state });
  expect(await adapter.readRevision(mapId, 1)).toEqual(first);
  expect(await adapter.readRevision(mapId, 2)).toEqual({ kind: 'found', value: revision });
  expect(await adapter.readRevision(mapId, 3)).toMatchObject({ kind: 'not_found', code: 'revision_not_found' });
  expect(await Promise.all([adapter.readCurrent(otherId), adapter.readRevision(otherId, 1), adapter.readRevision(otherId, 2)])).toEqual(unrelated);
  const pinned = structuredClone(winner);
  const later = await commitCommands(adapter, [{ kind: 'ticket.create', ticket: ticket('C') }, dependency('dependency.add', identity, 'C')]);
  expect(later.frontier).toEqual(['C']);
  expect(winner).toEqual(pinned);
  expect(await adapter.readRevision(mapId, 2)).toEqual({ kind: 'found', value: revision });
});

test('S09/G01: internal publication failure with Tickets/Dependencies leaves the complete known state and history unchanged', async () => {
  let fail = false;
  const adapter = createMemoryAdapterWithFault(() => { if (fail) throw new Error('Storage failure'); });
  for (const identity of [mapId, otherId]) {
    const prepared = prepareCreate({ id: identity, title: 'Plan', destination: 'Arrive', author });
    if (prepared.kind !== 'ok') throw new Error('Expected create');
    await adapter.commit(prepared.value);
  }
  const before = await observe(adapter);
  const prepared = prepareApply(await current(adapter), request([{ kind: 'ticket.create', ticket: ticket('A') },
    { kind: 'ticket.create', ticket: ticket('B') }, dependency('dependency.add', 'A', 'B')]));
  if (prepared.kind !== 'prepared') throw new Error('Expected graph preparation');
  fail = true;
  await expect(adapter.commit(prepared.change)).rejects.toThrow('Storage failure');
  expect(await observe(adapter)).toEqual(before);
  fail = false;
  expect(await adapter.commit(prepared.change)).toMatchObject({ kind: 'committed', frontier: ['B'] });
});

test('V06/S07/G06: caller inputs, opaque preparation, Frontier, commits and historical nested Tickets cannot alias storage', async () => {
  const adapter = await setup();
  const extensions = { 'app.nested': { values: [1, 2] } };
  const raw = request([{ kind: 'ticket.create', ticket: { ...ticket('A'), extensions } }]);
  const decoded = decodeApplyRequest(raw);
  if (decoded.kind !== 'ok') throw new Error('Expected decoding');
  extensions['app.nested'].values[0] = 99;
  const prepared = prepareApply(await current(adapter), decoded.value);
  if (prepared.kind !== 'prepared') throw new Error('Expected preparation');
  const expectedTicket = { ...ticket('A'), extensions: { 'app.nested': { values: [1, 2] } },
    prerequisites: [], status: 'open', claim: null };
  Reflect.set(prepared.change.next.tickets[0]!, 'title', 'Corrupted');
  Reflect.set(prepared.frontier, '0', 'Corrupted');
  const committed = await adapter.commit(prepared.change);
  if (committed.kind !== 'committed') throw new Error('Expected commit');
  const snapshot = await observe(adapter, 2);
  const head = await current(adapter);
  const historical = await adapter.readRevision(mapId, 2);
  if (historical.kind !== 'found') throw new Error('Expected history');
  const views = [prepared.change.next, committed.revision.state, head, historical.value.state];
  for (const view of views) {
    expect(view.tickets).toEqual([expectedTicket]);
    Reflect.set(view.tickets[0]!, 'question', 'Corrupted');
    Reflect.set(view.tickets[0]!.prerequisites, '0', 'Missing');
    const nested = view.tickets[0]!.extensions['app.nested'] as { values: number[] };
    Reflect.set(nested.values, '0', 500);
    expect(Object.hasOwn(view, 'frontier')).toBe(false);
  }
  Reflect.set(committed.frontier, '0', 'Corrupted');
  const derived = calculateFrontier(head);
  Reflect.set(derived, '0', 'Corrupted');
  expect(derived).toEqual(['A']);
  expect(committed.frontier).toEqual(['A']);
  expect(await observe(adapter, 2)).toEqual(snapshot);
});

test.each([
  { kind: 'dependency.add', dependent: 'A', prerequisite: 'A', code: 'self_dependency', ids: ['A'] },
  { kind: 'dependency.add', dependent: 'A', prerequisite: 'B', code: 'dependency_already_exists', ids: ['A', 'B'] },
  { kind: 'dependency.remove', dependent: 'B', prerequisite: 'A', code: 'dependency_not_found', ids: ['B', 'A'] },
  ...(['dependency.add', 'dependency.remove'] as const).flatMap(kind => [
    { kind, dependent: 'Missing', prerequisite: 'B', code: 'ticket_not_found', ids: ['Missing'] },
    { kind, dependent: 'A', prerequisite: 'OnlyOther', code: 'ticket_not_found', ids: ['OnlyOther'] },
  ]),
])('G01/G02/A03: $kind $dependent -> $prerequisite rejects $code, preserving complete state/history', async ({ kind, dependent, prerequisite, code, ids }) => {
  const adapter = await setup();
  await commitCommands(adapter, [{ kind: 'ticket.create', ticket: ticket('A') }, { kind: 'ticket.create', ticket: ticket('B') },
    dependency('dependency.add', 'A', 'B')]);
  const other = await current(adapter, otherId);
  const preparedOther = prepareApply(other, { ...request([{ kind: 'ticket.create', ticket: ticket('OnlyOther') }]), mapId: otherId });
  if (preparedOther.kind !== 'prepared') throw new Error('Expected other Map preparation');
  await adapter.commit(preparedOther.change);
  const before = await observe(adapter, 2);
  expect(prepareApply(await current(adapter), request([{ kind: 'map.update', patch: { title: 'Never publish' } },
    dependency(kind as 'dependency.add' | 'dependency.remove', dependent, prerequisite)], 2))).toEqual({
    kind: 'rejected', rejection: { stage: 'command', commandIndex: 1, code, ticketIds: ids },
  });
  expect(await observe(adapter, 2)).toEqual(before);
});

test('G01: adding a settled prerequisite retains the edge without blocking an unclaimed dependent (fixture)', async () => {
  const adapter = await setup();
  const fixture = { ...await current(adapter), tickets: [storedTicket('A'), storedTicket('B', 'settled')] };
  const original = structuredClone(fixture);
  const prepared = prepareApply(fixture, request([dependency('dependency.add', 'A', 'B')]));
  if (prepared.kind !== 'prepared') throw new Error('Expected settled prerequisite');
  expect(prepared.frontier).toEqual(['A']);
  expect(prepared.change.next.tickets).toEqual([{ ...fixture.tickets[0], prerequisites: ['B'] }, fixture.tickets[1]]);
  expect(fixture).toEqual(original);
});

test('Final claimed invariant: matching edit access does not permit blocking an existing Claim (fixture, no Claim commands)', async () => {
  const adapter = await setup();
  const fixture = { ...await current(adapter), tickets: [storedTicket('A', 'claimed'), storedTicket('B')] };
  const original = structuredClone(fixture);
  const before = await observe(adapter);
  expect(prepareApply(fixture, request([{ kind: 'dependency.add', dependentId: id('Ticket', 'A'), prerequisiteId: id('Ticket', 'B'),
    claimantId: id('Claimant', 'session') }]))).toEqual({ kind: 'rejected', rejection: {
    stage: 'final_state', code: 'claimed_ticket_has_open_prerequisite', ticketIds: ['A', 'B'],
  } });
  expect(fixture).toEqual(original);
  expect(await observe(adapter)).toEqual(before);
});

test.each(['grilling', 'prototype', 'research', 'task'] as const)('T02: updating an open Ticket to %s uses the same type vocabulary as creation', async type => {
  const adapter = await setup();
  await commitCommands(adapter, [{ kind: 'ticket.create', ticket: ticket('A') }]);
  const old = await adapter.readRevision(mapId, 2);
  const initial = await current(adapter);
  const result = await commitCommands(adapter, [{ kind: 'ticket.update', ticketId: id('Ticket', 'A'), patch: { type, question: 'Next?' } }]);
  expect(result.revision.state).toEqual({ ...initial, currentRevision: 3,
    tickets: [{ ...ticket('A'), type, question: 'Next?', extensions: {}, prerequisites: [], status: 'open', claim: null }] });
  expect(result.frontier).toEqual(['A']);
  expect(await adapter.readRevision(mapId, 2)).toEqual(old);
});

test('G06: exact ASCII lexical ordering includes numeric strings, mixed case and valid punctuation', async () => {
  const adapter = await setup();
  const values = ['2', '10', 'A:0', 'A_0', 'A-0', 'A.0', 'a', 'A', '0', 'A0'];
  const fixture = { ...await current(adapter), tickets: values.map(value => storedTicket(value)) };
  expect(calculateFrontier(fixture)).toEqual(['0', '10', '2', 'A', 'A-0', 'A.0', 'A0', 'A:0', 'A_0', 'a']);
});

test('A07: removing then readding one of several prerequisites cancels the relationship change, despite array reorder', async () => {
  const adapter = await setup();
  await commitCommands(adapter, [{ kind: 'ticket.create', ticket: ticket('A') }, { kind: 'ticket.create', ticket: ticket('B') },
    { kind: 'ticket.create', ticket: ticket('C') }, dependency('dependency.add', 'A', 'B'), dependency('dependency.add', 'A', 'C')]);
  const before = await observe(adapter, 2);
  const state = await current(adapter);
  const original = structuredClone(state);
  expect(prepareApply(state, request([dependency('dependency.remove', 'A', 'B'), dependency('dependency.add', 'A', 'B')], 2)))
    .toEqual({ kind: 'rejected', rejection: { stage: 'final_state', code: 'no_changes' } });
  expect(state).toEqual(original);
  expect(await observe(adapter, 2)).toEqual(before);
});

test.each([
  { label: 'descriptive change', patch: { title: 'Changed' } },
  { label: 'ordered JSON array change', patch: { extensions: { 'app.values': [2, 1] } } },
])('A07: ignoring prerequisite order must not hide a real $label', async ({ patch }) => {
  const adapter = await setup();
  await commitCommands(adapter, [{ kind: 'ticket.create', ticket: { ...ticket('A'), extensions: { 'app.values': [1, 2] } } },
    { kind: 'ticket.create', ticket: ticket('B') }, { kind: 'ticket.create', ticket: ticket('C') },
    dependency('dependency.add', 'A', 'B'), dependency('dependency.add', 'A', 'C')]);
  const old = await adapter.readRevision(mapId, 2);
  const initial = await current(adapter);
  const result = await commitCommands(adapter, [dependency('dependency.remove', 'A', 'B'), dependency('dependency.add', 'A', 'B'),
    { kind: 'ticket.update', ticketId: id('Ticket', 'A'), patch }]);
  expect(result.revision.state).toEqual({ ...initial, currentRevision: 3,
    tickets: initial.tickets.map(item => item.id === 'A' ? { ...item, ...patch, prerequisites: ['C', 'B'] } : item) });
  expect(result.revision.changes).toEqual([
    { commandIndex: 0, command: 'dependency.remove', subjectId: 'A' },
    { commandIndex: 1, command: 'dependency.add', subjectId: 'A' },
    { commandIndex: 2, command: 'ticket.update', subjectId: 'A' },
  ]);
  expect(await adapter.readRevision(mapId, 2)).toEqual(old);
  expect(await adapter.readRevision(mapId, 3)).toEqual({ kind: 'found', value: result.revision });
});
