import { expect, test } from 'vitest';
import { calculateFrontier, createMemoryAdapter, decodeApplyRequest, parseId, prepareApply, prepareCreate } from '../src/index.js';
import type { ApplyRequest, Command, NonEmpty, Settlement, StateAdapter, StoredMapState, TicketType } from '../src/index.js';
import { createMemoryAdapterWithFault } from '../src/memory-adapter.js';

function id<K extends string>(kind: K, value: string) {
  const parsed = parseId(kind, value);
  if (parsed.kind !== 'ok') throw new Error('Invalid fixture ID');
  return parsed.value;
}
const mapId = id('Map', 'Alpha');
const otherId = id('Map', 'Other');
const a = id('Ticket', 'A');
const b = id('Ticket', 'B');
const c = id('Ticket', 'C');
const claimantId = id('Claimant', 'work:Alpha');
const wrongClaimant = id('Claimant', 'work:Other');
const author = { actorId: id('Actor', 'kun'), clientId: id('Client', 'codex'), occurredAt: '2026-09-18T05:00:00Z' };
const ticket = (identity: string, type: TicketType = 'task') => ({ id: id('Ticket', identity), title: `Ticket ${identity}`, question: 'Next step?', type });
const common = () => ({ evidence: [{ statement: ' Checked source\n', references: [{ locator: ' opaque source ♥ ', label: '' }],
  provenance: { method: ' Inspection ', sources: [{ locator: 'session:Alpha' }] }, extensions: { 'demo.evidence': [true, null] } }],
  references: [{ locator: 'artifact:local', label: ' Artifact ' }], provenance: { method: ' Worked ', sources: [{ locator: 'session:Alpha' }] },
  extensions: { 'demo.result': { reviewed: true } } });
const decision: Settlement<'grilling'> = { ...common(), outcome: { kind: 'decision', statement: ' Choose route\n', rationale: ' Because inspected ' } };
const finding: Settlement<'research'> = { ...common(), outcome: { kind: 'finding', statement: ' No conclusive result ', limitations: ' Only checked this scope ' } };
const completion: Settlement<'task'> = { ...common(), outcome: { kind: 'completion', statement: ' Done\n',
  resultingFacts: { arbitraryKey: { nested: [true, null, 3, '♥'] } } } };
const cases = [
  { ticketType: 'grilling' as const, settlement: decision }, { ticketType: 'prototype' as const, settlement: decision },
  { ticketType: 'research' as const, settlement: finding }, { ticketType: 'task' as const, settlement: completion },
];
function request(commands: NonEmpty<Command>, expectedRevision: number): ApplyRequest { return { mapId, expectedRevision, author, commands }; }
async function current(adapter: StateAdapter, identity = mapId): Promise<StoredMapState> {
  const read = await adapter.readCurrent(identity);
  if (read.kind !== 'found') throw new Error('Expected current Map');
  return read.value;
}
async function observe(adapter: StateAdapter, head: number) {
  return structuredClone(await Promise.all([mapId, otherId, id('Map', 'Missing')].map(async identity => ({
    current: await adapter.readCurrent(identity), history: await Promise.all(Array.from({ length: head + 1 }, (_, i) => adapter.readRevision(identity, i + 1))),
  }))));
}
async function commitCommands(adapter: StateAdapter, commands: NonEmpty<Command>) {
  const state = await current(adapter);
  const decoded = decodeApplyRequest(request(commands, state.currentRevision));
  if (decoded.kind !== 'ok') throw new Error(`Expected decoding: ${JSON.stringify(decoded)}`);
  const prepared = prepareApply(state, decoded.value);
  if (prepared.kind !== 'prepared') throw new Error(`Expected preparation: ${JSON.stringify(prepared)}`);
  const committed = await adapter.commit(prepared.change);
  if (committed.kind !== 'committed') throw new Error('Expected commit');
  return committed;
}
async function setup(type: TicketType = 'task', adapter = createMemoryAdapter()) {
  for (const identity of [mapId, otherId]) {
    const prepared = prepareCreate({ id: identity, title: 'Plan', destination: 'Arrive', author });
    if (prepared.kind !== 'ok' || (await adapter.commit(prepared.value)).kind !== 'committed') throw new Error('Expected creation');
  }
  await commitCommands(adapter, [{ kind: 'ticket.create', ticket: ticket('A', type) }, { kind: 'ticket.create', ticket: ticket('B') }]);
  const other = prepareApply(await current(adapter, otherId), { ...request([
    { kind: 'ticket.create', ticket: ticket('Outside') }, { kind: 'claim.acquire', ticketId: id('Ticket', 'Outside'), claimantId: wrongClaimant },
  ], 1), mapId: otherId });
  if (other.kind !== 'prepared' || (await adapter.commit(other.change)).kind !== 'committed') throw new Error('Expected unrelated Map');
  return adapter;
}

test.each(cases)('T03/T04/T07/C06/A01/H01: $ticketType Settlement commits its exact typed result, clears Claim and derives introduction context', async fixture => {
  const adapter = await setup(fixture.ticketType);
  await commitCommands(adapter, [{ kind: 'claim.acquire', ticketId: a, claimantId }]);
  const state = await current(adapter);
  const before = await observe(adapter, 3);
  const raw = { ...request([{ kind: 'map.update', patch: { notes: 'Accepted result' } }], 3), commands: [
    { kind: 'map.update', patch: { notes: 'Accepted result' } }, { kind: 'ticket.settle', ticketId: a, claimantId, ...fixture },
  ] };
  const original = structuredClone(raw);
  const decoded = decodeApplyRequest(raw);
  expect(decoded.kind).toBe('ok');
  if (decoded.kind !== 'ok') throw new Error('Expected Settlement decode');
  const prepared = prepareApply(state, decoded.value);
  if (prepared.kind !== 'prepared') throw new Error(`Expected Settlement: ${JSON.stringify(prepared)}`);
  expect(prepareApply(state, decoded.value)).toEqual(prepared);
  expect(prepared.frontier).toEqual(['B']);
  expect(await observe(adapter, 3)).toEqual(before);
  expect(raw).toEqual(original);
  expect(state).toEqual(before[0]!.current.kind === 'found' ? before[0]!.current.value : undefined);
  const next = { ...state, currentRevision: 4, notes: 'Accepted result', tickets: [
    { ...state.tickets[0], status: 'settled', claim: null, settlement: { ...fixture.settlement, introducedAtRevision: 4 } }, state.tickets[1],
  ] };
  const revision = { mapId, revision: 4, priorRevision: 3, kind: 'apply', author,
    changes: [{ commandIndex: 0, command: 'map.update', subjectId: 'Alpha' }, { commandIndex: 1, command: 'ticket.settle', subjectId: 'A' }], state: next };
  expect(await adapter.commit(prepared.change)).toEqual({ kind: 'committed', revision, frontier: ['B'] });
  expect(await adapter.readCurrent(mapId)).toEqual({ kind: 'found', value: next });
  expect(await adapter.readRevision(mapId, 4)).toEqual({ kind: 'found', value: revision });
  const after = await observe(adapter, 4);
  expect(after[0]!.history.slice(0, 3)).toEqual(before[0]!.history.slice(0, 3));
  expect(after[1]!.current).toEqual(before[1]!.current);
  expect(after[1]!.history.slice(0, 4)).toEqual(before[1]!.history);
  expect(after[0]!.history[4]).toMatchObject({ kind: 'not_found', code: 'revision_not_found' });
});

test('T06/T07/H02/H03/H04: explicit reopening retains descriptions/Dependencies, and same-wording re-settlement gets new immutable introduction authorship', async () => {
  const adapter = await setup();
  await commitCommands(adapter, [{ kind: 'claim.acquire', ticketId: b, claimantId },
    { kind: 'ticket.settle', ticketId: b, ticketType: 'task', claimantId, settlement: completion },
    { kind: 'dependency.add', dependentId: a, prerequisiteId: b }, { kind: 'claim.acquire', ticketId: a, claimantId }]);
  const first = await commitCommands(adapter, [{ kind: 'ticket.settle', ticketId: a, ticketType: 'task', claimantId, settlement: completion }]);
  const unrelatedEdit = await commitCommands(adapter, [{ kind: 'map.update', patch: { notes: 'Does not reintroduce results' } }]);
  expect(unrelatedEdit.revision.state.tickets[0]).toEqual(first.revision.state.tickets[0]);
  const before = await observe(adapter, 5);
  const reason = '  Recheck the same route\n';
  const reopened = await commitCommands(adapter, [{ kind: 'ticket.reopen', ticketId: a, reason }]);
  expect(reopened).toEqual({ kind: 'committed', frontier: ['A'], revision: {
    mapId, revision: 6, priorRevision: 5, kind: 'apply', author,
    changes: [{ commandIndex: 0, command: 'ticket.reopen', subjectId: 'A', reason }],
    state: { ...unrelatedEdit.revision.state, currentRevision: 6, tickets: [
      { ...ticket('A'), extensions: {}, prerequisites: ['B'], status: 'open', claim: null }, unrelatedEdit.revision.state.tickets[1],
    ] },
  } });
  const claimed = await commitCommands(adapter, [{ kind: 'claim.acquire', ticketId: a, claimantId }]);
  const secondAuthor = { actorId: id('Actor', 'other-actor'), clientId: id('Client', 'another-client'), occurredAt: '2020-01-01T00:00:00Z' };
  const prepared = prepareApply(await current(adapter), { ...request([
    { kind: 'ticket.settle', ticketId: a, ticketType: 'task', claimantId, settlement: completion },
  ], 7), author: secondAuthor });
  if (prepared.kind !== 'prepared') throw new Error('Expected re-settlement');
  const second = await adapter.commit(prepared.change);
  if (second.kind !== 'committed') throw new Error('Expected second settlement');
  expect(second.revision.author).toEqual(secondAuthor);
  expect(second.revision.state.tickets[0]).toEqual({ ...ticket('A'), extensions: {}, prerequisites: ['B'], status: 'settled', claim: null,
    settlement: { ...completion, introducedAtRevision: 8 } });
  expect(first.revision.state.tickets[0]).toEqual({ ...ticket('A'), extensions: {}, prerequisites: ['B'], status: 'settled', claim: null,
    settlement: { ...completion, introducedAtRevision: 4 } });
  const after = await observe(adapter, 8);
  expect(after[0]!.history.slice(0, 5)).toEqual(before[0]!.history.slice(0, 5));
  expect(after[1]!.current).toEqual(before[1]!.current);
  expect(after[1]!.history.slice(0, 6)).toEqual(before[1]!.history);
  expect(await adapter.readRevision(mapId, 4)).toEqual({ kind: 'found', value: first.revision });
  expect(await adapter.readRevision(mapId, 7)).toEqual({ kind: 'found', value: claimed.revision });
  expect(await adapter.readRevision(mapId, 8)).toEqual({ kind: 'found', value: second.revision });
  expect(await observe(adapter, 8)).toEqual(after);
  expect(calculateFrontier(await current(adapter))).toEqual([]);
});

async function rejectCommands(adapter: StateAdapter, commands: NonEmpty<Command>, rejection: unknown) {
  const state = await current(adapter);
  const before = await observe(adapter, state.currentRevision);
  const input = request(commands, state.currentRevision);
  const original = structuredClone([state, input]);
  expect(prepareApply(state, input)).toEqual({ kind: 'rejected', rejection });
  expect([state, input]).toEqual(original);
  expect(await observe(adapter, state.currentRevision)).toEqual(before);
}
async function settledPair(adapter = createMemoryAdapter()) {
  await setup('task', adapter);
  await commitCommands(adapter, [{ kind: 'dependency.add', dependentId: a, prerequisiteId: b }]);
  const claimedB = await commitCommands(adapter, [{ kind: 'claim.acquire', ticketId: b, claimantId }]);
  const settledB = await commitCommands(adapter, [{ kind: 'ticket.settle', ticketId: b, ticketType: 'task', claimantId, settlement: completion }]);
  const claimedA = await commitCommands(adapter, [{ kind: 'claim.acquire', ticketId: a, claimantId }]);
  const settledA = await commitCommands(adapter, [{ kind: 'ticket.settle', ticketId: a, ticketType: 'task', claimantId, settlement: completion }]);
  return { adapter, claimedA, claimedB, settledA, settledB };
}

test('E01/G03/H01/H03/S08: real end-to-end workflow unlocks Frontier and explicitly reopens both Tickets with original results and historical Claims intact', async () => {
  const { adapter, claimedA, claimedB, settledA, settledB } = await settledPair();
  expect(claimedB.frontier).toEqual([]);
  expect(settledB.frontier).toEqual(['A']);
  expect(claimedA.frontier).toEqual([]);
  expect(settledA.frontier).toEqual([]);
  expect(settledA.revision.state.tickets).toEqual([
    { ...ticket('A'), extensions: {}, prerequisites: ['B'], status: 'settled', claim: null, settlement: { ...completion, introducedAtRevision: 7 } },
    { ...ticket('B'), extensions: {}, prerequisites: [], status: 'settled', claim: null, settlement: { ...completion, introducedAtRevision: 5 } },
  ]);
  const before = await observe(adapter, 7);
  const reopened = await commitCommands(adapter, [{ kind: 'ticket.reopen', ticketId: b, reason: ' Upstream first ' },
    { kind: 'ticket.reopen', ticketId: a, reason: ' Dependent reconsideration\n' }]);
  expect(reopened.frontier).toEqual(['B']);
  expect(reopened.revision.state.tickets).toEqual([
    { ...ticket('A'), extensions: {}, prerequisites: ['B'], status: 'open', claim: null },
    { ...ticket('B'), extensions: {}, prerequisites: [], status: 'open', claim: null },
  ]);
  expect(reopened.revision.changes).toEqual([
    { commandIndex: 0, command: 'ticket.reopen', subjectId: 'B', reason: ' Upstream first ' },
    { commandIndex: 1, command: 'ticket.reopen', subjectId: 'A', reason: ' Dependent reconsideration\n' },
  ]);
  const after = await observe(adapter, 8);
  expect(after[0]!.history.slice(0, 7)).toEqual(before[0]!.history.slice(0, 7));
  expect(after[1]!.current).toEqual(before[1]!.current);
  expect(after[1]!.history.slice(0, 8)).toEqual(before[1]!.history);
  for (const committed of [claimedB, settledB, claimedA, settledA]) {
    expect(await adapter.readRevision(mapId, committed.revision.revision)).toEqual({ kind: 'found', value: committed.revision });
  }
  expect(await observe(adapter, 8)).toEqual(after);
  expect(calculateFrontier(await current(adapter))).toEqual(['B']);
});

test('G04: reopening upstream alone or only its direct dependent cannot silently reopen settled transitive descendants', async () => {
  const adapter = await setup();
  await commitCommands(adapter, [{ kind: 'ticket.create', ticket: ticket('C') }, { kind: 'dependency.add', dependentId: a, prerequisiteId: b },
    { kind: 'dependency.add', dependentId: c, prerequisiteId: a }, { kind: 'claim.acquire', ticketId: b, claimantId },
    { kind: 'ticket.settle', ticketId: b, ticketType: 'task', claimantId, settlement: completion },
    { kind: 'claim.acquire', ticketId: a, claimantId }, { kind: 'ticket.settle', ticketId: a, ticketType: 'task', claimantId, settlement: completion },
    { kind: 'claim.acquire', ticketId: c, claimantId }, { kind: 'ticket.settle', ticketId: c, ticketType: 'task', claimantId, settlement: completion }]);
  await rejectCommands(adapter, [{ kind: 'ticket.reopen', ticketId: b, reason: 'Reconsider upstream' }],
    { stage: 'final_state', code: 'settled_ticket_has_open_prerequisite', ticketIds: ['A', 'B'] });
  await rejectCommands(adapter, [{ kind: 'ticket.reopen', ticketId: b, reason: 'Reconsider upstream' },
    { kind: 'ticket.reopen', ticketId: a, reason: 'Direct dependent only' }],
  { stage: 'final_state', code: 'settled_ticket_has_open_prerequisite', ticketIds: ['C', 'A'] });
  const reopened = await commitCommands(adapter, [{ kind: 'ticket.reopen', ticketId: b, reason: 'Upstream' },
    { kind: 'ticket.reopen', ticketId: a, reason: 'Middle' }, { kind: 'ticket.reopen', ticketId: c, reason: 'Transitive descendant' }]);
  expect(reopened.frontier).toEqual(['B']);
  expect(reopened.revision.state.tickets.map(t => [t.id, t.status, t.claim, 'settlement' in t])).toEqual([
    ['A', 'open', null, false], ['B', 'open', null, false], ['C', 'open', null, false],
  ]);
});

test.each(['claim.release', 'claim.clear'] as const)('G05/H02: upstream reopening requires explicit %s for its claimed dependent', async kind => {
  const adapter = await setup();
  await commitCommands(adapter, [{ kind: 'dependency.add', dependentId: a, prerequisiteId: b }, { kind: 'claim.acquire', ticketId: b, claimantId },
    { kind: 'ticket.settle', ticketId: b, ticketType: 'task', claimantId, settlement: completion }, { kind: 'claim.acquire', ticketId: a, claimantId }]);
  await rejectCommands(adapter, [{ kind: 'ticket.reopen', ticketId: b, reason: 'New uncertainty' }],
    { stage: 'final_state', code: 'claimed_ticket_has_open_prerequisite', ticketIds: ['A', 'B'] });
  const clear: Command = kind === 'claim.clear' ? { kind, ticketId: a, expectedClaimantId: claimantId, reason: ' Pause downstream\n' }
    : { kind, ticketId: a, claimantId };
  const reopened = await commitCommands(adapter, [{ kind: 'ticket.reopen', ticketId: b, reason: ' New uncertainty ' }, clear]);
  expect(reopened.frontier).toEqual(['B']);
  expect(reopened.revision.state.tickets).toEqual([
    { ...ticket('A'), extensions: {}, prerequisites: ['B'], status: 'open', claim: null },
    { ...ticket('B'), extensions: {}, prerequisites: [], status: 'open', claim: null },
  ]);
  expect(reopened.revision.changes).toEqual([
    { commandIndex: 0, command: 'ticket.reopen', subjectId: 'B', reason: ' New uncertainty ' },
    { commandIndex: 1, command: kind, subjectId: 'A', ...(kind === 'claim.clear' ? { reason: ' Pause downstream\n' } : {}) },
  ]);
});

test('T05/A04: matching-Claim settlement checks prerequisites at its position, not after a later settlement', async () => {
  const adapter = await setup();
  await commitCommands(adapter, [{ kind: 'dependency.add', dependentId: a, prerequisiteId: b }, { kind: 'claim.acquire', ticketId: b, claimantId },
    { kind: 'ticket.settle', ticketId: b, ticketType: 'task', claimantId, settlement: completion }, { kind: 'claim.acquire', ticketId: a, claimantId }]);
  await rejectCommands(adapter, [{ kind: 'ticket.reopen', ticketId: b, reason: 'Temporary open prerequisite' },
    { kind: 'ticket.settle', ticketId: a, ticketType: 'task', claimantId, settlement: completion },
    { kind: 'claim.acquire', ticketId: b, claimantId }, { kind: 'ticket.settle', ticketId: b, ticketType: 'task', claimantId, settlement: completion }],
  { stage: 'command', commandIndex: 1, code: 'unsettled_dependency', ticketIds: ['A'] });
  const committed = await commitCommands(adapter, [{ kind: 'ticket.reopen', ticketId: b, reason: 'Recheck prerequisite first' },
    { kind: 'claim.acquire', ticketId: b, claimantId }, { kind: 'ticket.settle', ticketId: b, ticketType: 'task', claimantId, settlement: completion },
    { kind: 'ticket.settle', ticketId: a, ticketType: 'task', claimantId, settlement: completion }]);
  expect(committed.frontier).toEqual([]);
  expect(committed.revision.state.tickets.map(t => t.status === 'settled' ? t.settlement.introducedAtRevision : null)).toEqual([4, 4]);
});

test('A04: acquire before later prerequisite settlement fails, whereas settle then acquire/settle dependent publishes once', async () => {
  const adapter = await setup();
  await commitCommands(adapter, [{ kind: 'dependency.add', dependentId: a, prerequisiteId: b }, { kind: 'claim.acquire', ticketId: b, claimantId }]);
  await rejectCommands(adapter, [{ kind: 'claim.acquire', ticketId: a, claimantId },
    { kind: 'ticket.settle', ticketId: b, ticketType: 'task', claimantId, settlement: completion }],
  { stage: 'command', commandIndex: 0, code: 'unsettled_dependency', ticketIds: ['A'] });
  const committed = await commitCommands(adapter, [{ kind: 'ticket.settle', ticketId: b, ticketType: 'task', claimantId, settlement: completion },
    { kind: 'claim.acquire', ticketId: a, claimantId }, { kind: 'ticket.settle', ticketId: a, ticketType: 'task', claimantId, settlement: completion }]);
  expect(committed.revision.revision).toBe(4);
  expect(committed.frontier).toEqual([]);
  expect(committed.revision.state.tickets.map(t => t.status === 'settled' ? t.settlement.introducedAtRevision : null)).toEqual([4, 4]);
});

test.each(cases)('T05/A03: $ticketType settlement distinguishes missing Claim and wrong session without publishing an earlier edit', async fixture => {
  const adapter = await setup(fixture.ticketType);
  const command = { kind: 'ticket.settle', ticketId: a, claimantId: wrongClaimant, ...fixture } as Command;
  await rejectCommands(adapter, [{ kind: 'map.update', patch: { notes: 'Not published' } }, command],
    { stage: 'command', commandIndex: 1, code: 'claim_required', ticketIds: ['A'] });
  await commitCommands(adapter, [{ kind: 'claim.acquire', ticketId: a, claimantId }]);
  await rejectCommands(adapter, [{ kind: 'map.update', patch: { notes: 'Not published' } }, command],
    { stage: 'command', commandIndex: 1, code: 'claim_mismatch', ticketIds: ['A'] });
});

test.each(cases.flatMap(actual => cases.filter(command => command.ticketType !== actual.ticketType).map(command => ({ actual, command }))))(
  'T03: actual $actual.ticketType versus valid command $command.ticketType rejects with settlement_type_mismatch', async ({ actual, command }) => {
    const adapter = await setup(actual.ticketType);
    await commitCommands(adapter, [{ kind: 'claim.acquire', ticketId: a, claimantId }]);
    await rejectCommands(adapter, [{ kind: 'map.update', patch: { notes: 'Not published' } },
      { kind: 'ticket.settle', ticketId: a, claimantId, ...command } as Command],
    { stage: 'command', commandIndex: 1, code: 'settlement_type_mismatch', ticketIds: ['A'] });
  });

test.each([
  ...(['title', 'question', 'type', 'extensions'] as const).map(field => ({ kind: 'ticket.update', ticketId: a,
    patch: { [field]: field === 'type' ? 'research' : field === 'extensions' ? {} : 'Changed' } } as Command)),
  { kind: 'dependency.add', dependentId: a, prerequisiteId: b } as Command,
  { kind: 'dependency.remove', dependentId: a, prerequisiteId: b } as Command,
  { kind: 'ticket.settle', ticketId: a, ticketType: 'task', claimantId, settlement: completion } as Command,
])('T02/T03: settled Ticket is wholly immutable to $kind even with the original Claimant', async command => {
  const { adapter } = await settledPair();
  await rejectCommands(adapter, [{ kind: 'map.update', patch: { notes: 'Not published' } }, { ...command, claimantId } as Command],
    { stage: 'command', commandIndex: 1, code: 'ticket_not_open', ticketIds: ['A'] });
});

test.each(['ticket.settle', 'ticket.reopen'] as const)('T01/A03: %s target in another Map is not a local Ticket', async kind => {
  const adapter = await setup();
  const command: Command = kind === 'ticket.reopen' ? { kind, ticketId: id('Ticket', 'Outside'), reason: 'Not local' }
    : { kind, ticketId: id('Ticket', 'Outside'), ticketType: 'task', claimantId: wrongClaimant, settlement: completion };
  await rejectCommands(adapter, [{ kind: 'map.update', patch: { notes: 'Not published' } }, command],
    { stage: 'command', commandIndex: 1, code: 'ticket_not_found', ticketIds: ['Outside'] });
});

test.each([false, true])('T06/A03: reopen of an open Ticket (claimed=%s) returns ticket_not_settled, not an implicit release', async claimed => {
  const adapter = await setup();
  if (claimed) await commitCommands(adapter, [{ kind: 'claim.acquire', ticketId: a, claimantId }]);
  await rejectCommands(adapter, [{ kind: 'map.update', patch: { notes: 'Not published' } }, { kind: 'ticket.reopen', ticketId: a, reason: 'Not settled' }],
    { stage: 'command', commandIndex: 1, code: 'ticket_not_settled', ticketIds: ['A'] });
});

test.each([
  { label: 'Reference only', evidence: [], references: [{ locator: ' Opaque ♥ source ' }] },
  { label: 'Evidence with References', evidence: [{ statement: 'Observed', references: [{ locator: 'source' }], extensions: {} }], references: [] },
  { label: 'Evidence with explicit Provenance', evidence: [{ statement: 'Observed', references: [], provenance: { method: 'Direct inspection', sources: [] }, extensions: {} }], references: [] },
])('T04/V07: inconclusive Finding accepts $label without inventing a Decision or fetching sources', async support => {
  const adapter = await setup('research');
  const settlement: Settlement<'research'> = { outcome: { kind: 'finding', statement: 'Inconclusive after checking', limitations: '' },
    evidence: support.evidence, references: support.references, provenance: { method: 'Inspect', sources: [] }, extensions: {} };
  const committed = await commitCommands(adapter, [{ kind: 'claim.acquire', ticketId: a, claimantId },
    { kind: 'ticket.settle', ticketId: a, ticketType: 'research', claimantId, settlement }]);
  expect(committed.revision.state.tickets[0]).toEqual({ ...ticket('A', 'research'), extensions: {}, prerequisites: [], status: 'settled', claim: null,
    settlement: { ...settlement, introducedAtRevision: 3 } });
});

test.each(cases.filter(fixture => fixture.ticketType !== 'research'))('T04/V07: $ticketType permits empty Evidence/References and omitted optional outcome fields', async fixture => {
  const adapter = await setup(fixture.ticketType);
  const outcome = fixture.ticketType === 'task' ? { kind: 'completion', statement: 'Done' }
    : { kind: 'decision', statement: 'Chosen', rationale: 'Because' };
  const raw = { mapId, expectedRevision: 2, author, commands: [{ kind: 'claim.acquire', ticketId: a, claimantId },
    { kind: 'ticket.settle', ticketId: a, claimantId, ticketType: fixture.ticketType,
      settlement: { outcome, evidence: [], references: [], provenance: { method: 'inspect', sources: [] }, extensions: {} } }] };
  const decoded = decodeApplyRequest(raw);
  if (decoded.kind !== 'ok') throw new Error('Expected minimal Settlement');
  const committed = await commitCommands(adapter, decoded.value.commands);
  expect(committed.revision.state.tickets[0]).toMatchObject({ settlement: { outcome, introducedAtRevision: 3 } });
});

test('V05/T04: plain null-prototype resulting facts accept arbitrary keys and nested JSON, not the namespaced Extensions restriction', async () => {
  const adapter = await setup();
  const facts = Object.assign(Object.create(null) as Record<string, unknown>, { arbitrary: [false, null, { count: 2 }], 'not a namespace': '♥' });
  const raw = { mapId, expectedRevision: 2, author, commands: [{ kind: 'claim.acquire', ticketId: a, claimantId },
    { kind: 'ticket.settle', ticketId: a, ticketType: 'task', claimantId, settlement: {
      ...completion, outcome: { kind: 'completion', statement: 'Done', resultingFacts: facts },
    } }] };
  const decoded = decodeApplyRequest(raw);
  if (decoded.kind !== 'ok') throw new Error('Expected arbitrary plain facts');
  const committed = await commitCommands(adapter, decoded.value.commands);
  expect(committed.revision.state.tickets[0]).toMatchObject({ settlement: { outcome: { resultingFacts: {
    arbitrary: [false, null, { count: 2 }], 'not a namespace': '♥',
  } } } });
});

type Path = (string | number)[];
type InvalidSettlement = { label: string; ticketType: TicketType; settlement: unknown; path: Path };
function variant(ticketType: TicketType, path: Path, replacement: unknown, label = path.join('.')): InvalidSettlement {
  const source = ticketType === 'task' ? completion : ticketType === 'research' ? finding : decision;
  const settlement = structuredClone(source) as unknown as Record<string | number, unknown>;
  let target = settlement;
  for (const key of path.slice(0, -1)) target = target[key] as Record<string | number, unknown>;
  target[path.at(-1)!] = replacement;
  return { label: `${ticketType} ${label}`, ticketType, settlement, path };
}
const invalidSettlements: InvalidSettlement[] = cases.flatMap(({ ticketType }) => [
  ...[undefined, null, [], new Date(0)].map((settlement, index) => ({ label: `${ticketType} invalid Settlement ${index}`, ticketType, settlement, path: [] })),
  ...['outcome', 'evidence', 'references', 'provenance', 'extensions'].map(key => variant(ticketType, [key], undefined, `missing ${key}`)),
  ...['introducedAtRevision', 'id', 'actorId', 'clientId', 'occurredAt', 'transcript', 'status', 'claim'].map(key => variant(ticketType, [key], 4, `unsupported ${key}`)),
  ...[undefined, null, [], new Date(0)].map((value, index) => variant(ticketType, ['outcome'], value, `invalid outcome ${index}`)),
  ...[undefined, null, 10, '', ' \n'].map((value, index) => variant(ticketType, ['outcome', 'statement'], value, `invalid statement ${index}`)),
  ...['decision', 'finding', 'completion'].filter(kind => kind !== (ticketType === 'task' ? 'completion' : ticketType === 'research' ? 'finding' : 'decision'))
    .map(kind => variant(ticketType, ['outcome'], { kind, statement: 'Structurally known but incompatible' }, `incompatible ${kind}`))
    .map(entry => ({ ...entry, path: ['outcome', 'kind'] })),
  variant(ticketType, ['outcome', 'id'], 'independent-result-id', 'independent outcome ID'),
  variant(ticketType, ['provenance', 'method'], ' \n', 'blank Provenance method'),
  variant(ticketType, ['provenance', 'sources'], undefined, 'missing Provenance sources'),
  variant(ticketType, ['provenance', 'actorId'], 'kun', 'duplicated Provenance author'),
  variant(ticketType, ['provenance', 'sources', 0, 'locator'], '', 'blank source locator'),
  variant(ticketType, ['references', 0, 'locator'], ' \n', 'blank Reference locator'),
  variant(ticketType, ['references', 0, 'label'], undefined, 'undefined supplied label'),
  variant(ticketType, ['references', 0, 'id'], 'reference:1', 'independent Reference ID'),
  variant(ticketType, ['evidence', 0, 'statement'], '', 'blank Evidence statement'),
  variant(ticketType, ['evidence', 0, 'references'], undefined, 'missing Evidence References'),
  variant(ticketType, ['evidence', 0, 'provenance'], undefined, 'invalid supplied optional Evidence Provenance'),
  variant(ticketType, ['evidence', 0, 'provenance', 'method'], '', 'blank Evidence Provenance method'),
  variant(ticketType, ['evidence', 0, 'provenance', 'sources', 0, 'locator'], '', 'blank Evidence source locator'),
  variant(ticketType, ['evidence', 0, 'extensions'], undefined, 'missing Evidence Extensions'),
  variant(ticketType, ['evidence', 0, 'id'], 'evidence:1', 'independent Evidence ID'),
  { ...variant(ticketType, ['evidence', 0], { statement: 'Unattributed', references: [], extensions: {} }, 'Evidence needs source or Provenance'),
    path: ['evidence', 0, 'provenance'] },
]);
invalidSettlements.push(...(['grilling', 'prototype'] as const).flatMap(type => [undefined, null, 10, '', ' \n'].map((value, index) =>
  variant(type, ['outcome', 'rationale'], value, `invalid rationale ${index}`))));
invalidSettlements.push(variant('research', ['outcome', 'limitations'], 12, 'nonstring limitations'));
invalidSettlements.push({ ticketType: 'research', label: 'Finding lacks both Evidence and References', path: ['evidence'], settlement: {
  ...finding, evidence: [], references: [],
} });
const cycle: Record<string, unknown> = {};
cycle.loop = cycle;
const badFacts: unknown[] = [undefined, null, [], 'text', 10, new Date(0)];
invalidSettlements.push(...badFacts.map((value, index) => variant('task', ['outcome', 'resultingFacts'], value, `invalid facts root ${index}`)));
invalidSettlements.push(...[undefined, Infinity, NaN, -Infinity, new Date(0), new Map(), () => 1, Symbol('bad'), 1n]
  .map((value, index) => variant('task', ['outcome', 'resultingFacts', 'value'], value, `invalid nested JSON ${index}`)));
invalidSettlements.push({ ...variant('task', ['outcome', 'resultingFacts'], cycle, 'cyclic facts'), path: ['outcome', 'resultingFacts', 'loop'] });
invalidSettlements.push(...(['extensions', 'evidence'] as const).flatMap(section => {
  const path: Path = section === 'extensions' ? ['extensions'] : ['evidence', 0, 'extensions'];
  return [{ ...variant('task', path, { bad: true }, `unnamespaced ${section}`), path: [...path, 'bad'] },
  ...[undefined, Infinity, () => 1, Symbol('bad'), new Date(0)].map((value, index) => ({
    ...variant('task', path, { 'demo.value': value }, `invalid ${section} JSON ${index}`), path: [...path, 'demo.value'],
  }))];
}));
test.each(invalidSettlements)('V04/V05/V07/T03/T04/A02: $label rejects through raw and typed seams before stale-head comparison or an earlier Claim release', async ({ ticketType, settlement, path }) => {
  const adapter = await setup(ticketType);
  await commitCommands(adapter, [{ kind: 'claim.acquire', ticketId: a, claimantId }]);
  const before = await observe(adapter, 3);
  const state = await current(adapter);
  const originalState = structuredClone(state);
  const raw = { mapId, expectedRevision: 99, author, commands: [
    { kind: 'claim.release', ticketId: a, claimantId }, { kind: 'ticket.settle', ticketId: a, ticketType, claimantId, settlement },
  ] };
  const expectedPath = ['commands', 1, 'settlement', ...path];
  expect(decodeApplyRequest(raw)).toMatchObject({ kind: 'error', error: { code: 'invalid_input', path: expectedPath } });
  expect(prepareApply(state, raw as unknown as ApplyRequest)).toMatchObject({ kind: 'rejected', rejection: {
    stage: 'input', error: { code: 'invalid_input', path: expectedPath },
  } });
  expect(state).toEqual(originalState);
  expect(await observe(adapter, 3)).toEqual(before);
});

const arrayLocations: Path[] = [['evidence'], ['references'], ['provenance', 'sources'], ['evidence', 0, 'references'],
  ['evidence', 0, 'provenance', 'sources'], ['outcome', 'resultingFacts', 'entries']];
const getterArray = Object.defineProperty([{}], '0', { enumerable: true, get() { throw new Error('Array getter must not execute'); } });
const hiddenArray = Object.defineProperty([{}], '0', { enumerable: false, value: {} });
const badArrays = [
  { label: 'nonarray', value: null, suffix: [] }, { label: 'subclass', value: new (class extends Array {})(), suffix: [] },
  { label: 'sparse', value: new Array(1), suffix: [0] }, { label: 'getter', value: getterArray, suffix: [0] },
  { label: 'hidden', value: hiddenArray, suffix: [0] }, { label: 'extra field', value: Object.assign([], { extra: true }), suffix: ['extra'] },
  { label: 'symbol field', value: Object.assign([], { [Symbol('extra')]: true }), suffix: ['Symbol(extra)'] },
];
test.each(arrayLocations.flatMap(path => badArrays.filter(entry => !(path.includes('entries') && entry.value === null)).map(entry => ({ path, ...entry }))))(
  'V04/V05/V07/A02: $path rejects $label arrays, including Evidence/Provenance/References/resultingFacts', async ({ path, value, suffix }) => {
    const adapter = await setup();
    const before = await observe(adapter, 2);
    const raw = { mapId, expectedRevision: 99, author, commands: [{ kind: 'map.update', patch: { notes: 'No partial write' } },
      { kind: 'ticket.settle', ticketId: a, ticketType: 'task', claimantId, settlement: variant('task', path, value).settlement }] };
    const expectedPath = ['commands', 1, 'settlement', ...path, ...suffix];
    expect(decodeApplyRequest(raw)).toMatchObject({ kind: 'error', error: { path: expectedPath } });
    expect(prepareApply(await current(adapter), raw as unknown as ApplyRequest)).toMatchObject({ kind: 'rejected', rejection: {
      stage: 'input', error: { path: expectedPath },
    } });
    expect(await observe(adapter, 2)).toEqual(before);
  });

const rawCommands: { label: string; command: unknown; path: Path }[] = [
  ...[undefined, null, 10, 'task ', 'decision', 'constructor', 'toString'].map(ticketType => ({ label: `invalid Ticket type ${String(ticketType)}`,
    command: { kind: 'ticket.settle', ticketId: a, claimantId, ticketType, settlement: completion }, path: ['ticketType'] })),
  ...(['ticketId', 'claimantId'] as const).flatMap(key => [undefined, null, 10, '', 'bad id', 'a'.repeat(129), '♥'].map((value, index) => ({
    label: `settlement invalid ${key} ${index}`, command: { kind: 'ticket.settle', ticketId: a, claimantId, ticketType: 'task', settlement: completion, [key]: value }, path: [key],
  }))),
  ...(['status', 'claim', 'introducedAtRevision', 'reason', 'actorId', 'clientId', 'occurredAt', 'claimId'] as const).map(key => ({
    label: `settlement unsupported ${key}`, command: { kind: 'ticket.settle', ticketId: a, claimantId, ticketType: 'task', settlement: completion, [key]: 'unsupported' }, path: [key],
  })),
  ...[undefined, null, 10, '', ' \n\t'].map((reason, index) => ({ label: `invalid reopening reason ${index}`,
    command: { kind: 'ticket.reopen', ticketId: a, reason }, path: ['reason'] })),
  ...[undefined, '', 'bad id'].map(ticketId => ({ label: `invalid reopen target ${String(ticketId)}`, command: { kind: 'ticket.reopen', ticketId, reason: 'Recheck' }, path: ['ticketId'] })),
  ...(['claimantId', 'settlement', 'status', 'introducedAtRevision', 'cascade', 'admin'] as const).map(key => ({ label: `reopen unsupported ${key}`,
    command: { kind: 'ticket.reopen', ticketId: a, reason: 'Recheck', [key]: 'unsupported' }, path: [key] })),
];
test.each(rawCommands)('V03/V04/T06/A02: $label rejects through raw/typed seams before any earlier mutation/stale check', async ({ command, path }) => {
  const { adapter } = await settledPair();
  const before = await observe(adapter, 7);
  const raw = { mapId, expectedRevision: 99, author, commands: [{ kind: 'ticket.reopen', ticketId: a, reason: 'Would remove old result' }, command] };
  const expectedPath = ['commands', 1, ...path];
  expect(decodeApplyRequest(raw)).toMatchObject({ kind: 'error', error: { path: expectedPath } });
  expect(prepareApply(await current(adapter), raw as unknown as ApplyRequest)).toMatchObject({ kind: 'rejected', rejection: {
    stage: 'input', error: { path: expectedPath },
  } });
  expect(await observe(adapter, 7)).toEqual(before);
});

test.each([
  ['outcome', 'statement'], ['evidence', 0, 'statement'], ['provenance', 'method'], ['evidence', 0, 'provenance', 'method'],
  ['references', 0, 'locator'], ['outcome', 'resultingFacts', 'getter'],
].map(path => ({ path })))('V04/A02: getter at $path is rejected without executing it', async ({ path }) => {
  const adapter = await setup();
  const before = await observe(adapter, 2);
  const settlement = structuredClone(completion) as unknown as Record<string | number, unknown>;
  let target = settlement;
  for (const key of path.slice(0, -1)) target = target[key] as Record<string | number, unknown>;
  Object.defineProperty(target, path.at(-1)!, { enumerable: true, get() { throw new Error('Data getter must not execute'); } });
  const raw = { mapId, expectedRevision: 2, author, commands: [{ kind: 'ticket.settle', ticketId: a, claimantId, ticketType: 'task', settlement }] };
  const expectedPath = ['commands', 0, 'settlement', ...path];
  expect(decodeApplyRequest(raw)).toMatchObject({ kind: 'error', error: { path: expectedPath } });
  expect(prepareApply(await current(adapter), raw as unknown as ApplyRequest)).toMatchObject({ kind: 'rejected', rejection: { stage: 'input', error: { path: expectedPath } } });
  expect(await observe(adapter, 2)).toEqual(before);
});

test.each([
  ['provenance'], ['evidence', 0], ['evidence', 0, 'provenance'], ['references', 0], ['provenance', 'sources', 0],
  ['evidence', 0, 'references', 0], ['evidence', 0, 'provenance', 'sources', 0], ['extensions'], ['evidence', 0, 'extensions'],
].flatMap(path => [null, [], new Date(0), 12].map((value, index) => ({ path, value, label: index }))))(
  'V04/V07/A02: nonplain object $label at $path is rejected through both input seams', async ({ path, value }) => {
    const adapter = await setup();
    const before = await observe(adapter, 2);
    const raw = { mapId, expectedRevision: 99, author, commands: [{ kind: 'map.update', patch: { notes: 'No partial change' } },
      { kind: 'ticket.settle', ticketId: a, ticketType: 'task', claimantId, settlement: variant('task', path, value).settlement }] };
    const expectedPath = ['commands', 1, 'settlement', ...path];
    expect(decodeApplyRequest(raw)).toMatchObject({ kind: 'error', error: { path: expectedPath } });
    expect(prepareApply(await current(adapter), raw as unknown as ApplyRequest)).toMatchObject({ kind: 'rejected', rejection: { stage: 'input', error: { path: expectedPath } } });
    expect(await observe(adapter, 2)).toEqual(before);
  });

test.each(cases)('A07: acquire/settle/reopen of $ticketType with no net business change cannot manufacture history', async fixture => {
  const adapter = await setup(fixture.ticketType);
  await rejectCommands(adapter, [{ kind: 'claim.acquire', ticketId: a, claimantId },
    { kind: 'ticket.settle', ticketId: a, claimantId, ...fixture } as Command,
    { kind: 'ticket.reopen', ticketId: a, reason: 'Transient result' }], { stage: 'final_state', code: 'no_changes' });
});

test('T07/A07: reopen/acquire/re-settle identical wording in one batch is a new introduction, not a no-op', async () => {
  const { adapter, settledA } = await settledPair();
  const committed = await commitCommands(adapter, [{ kind: 'ticket.reopen', ticketId: a, reason: 'New acceptance of same result' },
    { kind: 'claim.acquire', ticketId: a, claimantId }, { kind: 'ticket.settle', ticketId: a, ticketType: 'task', claimantId, settlement: completion }]);
  expect(committed.revision.revision).toBe(8);
  expect(committed.revision.state.tickets[0]).toEqual({ ...ticket('A'), extensions: {}, prerequisites: ['B'], status: 'settled', claim: null,
    settlement: { ...completion, introducedAtRevision: 8 } });
  expect(await adapter.readRevision(mapId, 7)).toEqual({ kind: 'found', value: settledA.revision });
});

test.each(['settle', 'reopen'] as const)('S09: %s pre-publication failure preserves both populated Maps and every history record; explicit retry succeeds', async action => {
  let fail = false;
  const { adapter } = await settledPair(createMemoryAdapterWithFault(() => { if (fail) throw new Error('Publication failed'); }));
  let commands: NonEmpty<Command> = [{ kind: 'ticket.reopen', ticketId: b, reason: 'Upstream' }, { kind: 'ticket.reopen', ticketId: a, reason: 'Dependent' }];
  if (action === 'settle') {
    await commitCommands(adapter, [{ kind: 'ticket.reopen', ticketId: a, reason: 'Recheck' }, { kind: 'claim.acquire', ticketId: a, claimantId }]);
    commands = [{ kind: 'ticket.settle', ticketId: a, ticketType: 'task', claimantId, settlement: completion }];
  }
  const state = await current(adapter);
  const prepared = prepareApply(state, request(commands, state.currentRevision));
  if (prepared.kind !== 'prepared') throw new Error('Expected preparation');
  const before = await observe(adapter, state.currentRevision);
  fail = true;
  await expect(adapter.commit(prepared.change)).rejects.toThrow('Publication failed');
  expect(await observe(adapter, state.currentRevision)).toEqual(before);
  fail = false;
  expect(await adapter.commit(prepared.change)).toMatchObject({ kind: 'committed', revision: { revision: state.currentRevision + 1 } });
  const after = await observe(adapter, state.currentRevision + 1);
  expect(after[0]!.history.slice(0, state.currentRevision)).toEqual(before[0]!.history.slice(0, state.currentRevision));
  expect(after[1]!.current).toEqual(before[1]!.current);
  expect(after[1]!.history.slice(0, state.currentRevision + 1)).toEqual(before[1]!.history);
});

test('S04/S07: competing same-head Settlements publish one exact result/introduction and one Conflict; old proposals cannot replace it', async () => {
  const adapter = await setup();
  await commitCommands(adapter, [{ kind: 'claim.acquire', ticketId: a, claimantId }]);
  const state = await current(adapter);
  const before = await observe(adapter, 3);
  const proposals = ['First result', 'Second result'].map(statement => {
    const prepared = prepareApply(state, request([{ kind: 'ticket.settle', ticketId: a, ticketType: 'task', claimantId,
      settlement: { ...completion, outcome: { ...completion.outcome, statement } } }], 3));
    if (prepared.kind !== 'prepared') throw new Error('Expected competing Settlement');
    return prepared.change;
  });
  const results = await Promise.all(proposals.map(proposal => adapter.commit(proposal)));
  const winners = results.filter(result => result.kind === 'committed');
  expect(winners).toHaveLength(1);
  expect(results.filter(result => result.kind === 'conflict')).toEqual([{ kind: 'conflict', conflict: { mapId, expectedRevision: 3, currentRevision: 4 } }]);
  const winner = winners[0]!;
  expect(await adapter.readCurrent(mapId)).toEqual({ kind: 'found', value: winner.revision.state });
  expect(await adapter.readRevision(mapId, 4)).toEqual({ kind: 'found', value: winner.revision });
  expect(winner.frontier).toEqual(['B']);
  const after = await observe(adapter, 4);
  expect(after[0]!.history.slice(0, 3)).toEqual(before[0]!.history.slice(0, 3));
  expect(after[0]!.history[4]).toMatchObject({ kind: 'not_found', code: 'revision_not_found' });
  expect(after[1]!.current).toEqual(before[1]!.current);
  expect(after[1]!.history.slice(0, 4)).toEqual(before[1]!.history);
  for (const proposal of proposals) {
    expect(await adapter.commit(proposal)).toEqual({ kind: 'conflict', conflict: { mapId, expectedRevision: 3, currentRevision: 4 } });
    expect(await observe(adapter, 4)).toEqual(after);
  }
  await commitCommands(adapter, [{ kind: 'ticket.reopen', ticketId: a, reason: 'Later revision' }]);
  expect(winner.revision.revision).toBe(4);
  expect(winner.frontier).toEqual(['B']);
  expect(await adapter.readRevision(mapId, 4)).toEqual({ kind: 'found', value: winner.revision });
});

function attemptMutation(change: () => void) { try { change(); } catch (error) { if (!(error instanceof TypeError)) throw error; } }
function corruptResult(settlement: unknown) {
  const result = settlement as { outcome: { statement: string; rationale?: string; limitations?: string; resultingFacts?: { arbitraryKey: { nested: unknown[] } } };
    evidence: { statement: string; references: { locator: string }[]; provenance: { method: string; sources: { locator: string }[] }; extensions: { 'demo.evidence': unknown[] } }[];
    references: { locator: string }[]; provenance: { method: string; sources: { locator: string }[] }; extensions: { 'demo.result': { reviewed: boolean } }; introducedAtRevision?: number };
  for (const change of [
    () => { result.outcome.statement = 'Corrupted'; },
    () => { if ('rationale' in result.outcome) result.outcome.rationale = 'Corrupted'; },
    () => { if ('limitations' in result.outcome) result.outcome.limitations = 'Corrupted'; },
    () => { result.outcome.resultingFacts?.arbitraryKey.nested.push('Corrupted'); },
    () => { result.evidence[0]!.statement = 'Corrupted'; },
    () => { result.evidence[0]!.references[0]!.locator = 'Corrupted'; },
    () => { result.evidence[0]!.provenance.method = 'Corrupted'; },
    () => { result.evidence[0]!.provenance.sources[0]!.locator = 'Corrupted'; },
    () => { result.evidence[0]!.extensions['demo.evidence'].push('Corrupted'); },
    () => { result.references[0]!.locator = 'Corrupted'; },
    () => { result.provenance.method = 'Corrupted'; },
    () => { result.provenance.sources[0]!.locator = 'Corrupted'; },
    () => { result.extensions['demo.result'].reviewed = false; },
    () => { result.introducedAtRevision = 100; },
  ]) attemptMutation(change);
}
test.each(cases.flatMap(fixture => ['typed', 'decoded'].map(boundary => ({ fixture, boundary }))))(
  'S10/H04: $fixture.ticketType nested Settlement values from $boundary inputs/prepared/current/read/commit outputs cannot alias storage', async ({ fixture, boundary }) => {
    const adapter = await setup(fixture.ticketType);
    await commitCommands(adapter, [{ kind: 'claim.acquire', ticketId: a, claimantId }]);
    const raw = { mapId, expectedRevision: 3, author: { ...author }, commands: [
      { kind: 'ticket.settle', ticketId: a, claimantId, ticketType: fixture.ticketType, settlement: structuredClone(fixture.settlement) },
    ] };
    const decoded = decodeApplyRequest(raw);
    if (decoded.kind !== 'ok') throw new Error('Expected detached result');
    const state = structuredClone(await current(adapter));
    const input = boundary === 'typed' ? raw as unknown as ApplyRequest : decoded.value;
    const prepared = prepareApply(state, input);
    if (prepared.kind !== 'prepared') throw new Error('Expected detached preparation');
    corruptResult(raw.commands[0]!.settlement);
    (state.tickets[0] as { claim: unknown }).claim = null;
    const nextTicket = prepared.change.next.tickets[0]!;
    if (nextTicket.status !== 'settled') throw new Error('Expected stored result');
    corruptResult(nextTicket.settlement);
    attemptMutation(() => { (prepared.change.author as { occurredAt: string }).occurredAt = '2020-01-01T00:00:00Z'; });
    const committed = await adapter.commit(prepared.change);
    if (committed.kind !== 'committed') throw new Error('Expected isolated commit');
    expect(committed.revision.state.tickets[0]).toEqual({ ...ticket('A', fixture.ticketType), extensions: {}, prerequisites: [], status: 'settled', claim: null,
      settlement: { ...fixture.settlement, introducedAtRevision: 4 } });
    const before = await observe(adapter, 4);
    const read = await adapter.readRevision(mapId, 4);
    if (read.kind !== 'found') throw new Error('Expected historical result');
    for (const exposed of [committed.revision.state, read.value.state, await current(adapter)]) {
      const t = exposed.tickets[0]!;
      if (t.status !== 'settled') throw new Error('Expected exposed result');
      corruptResult(t.settlement);
      attemptMutation(() => { (t as unknown as { claim: unknown }).claim = claimantId; });
    }
    expect(await observe(adapter, 4)).toEqual(before);
    await commitCommands(adapter, [{ kind: 'ticket.reopen', ticketId: a, reason: 'Remove current result, preserve history' }]);
    expect(await adapter.readRevision(mapId, 4)).toEqual(before[0]!.history[3]);
    expect(calculateFrontier(await current(adapter))).toEqual(['A', 'B']);
  });

test('S11: commit captures mutable trusted-envelope nested result before publication and caller mutation, without adding an import port', async () => {
  let mutate: (() => void) | undefined;
  const adapter = await setup('task', createMemoryAdapterWithFault(() => { mutate?.(); }));
  await commitCommands(adapter, [{ kind: 'claim.acquire', ticketId: a, claimantId }]);
  const prepared = prepareApply(await current(adapter), request([{ kind: 'ticket.settle', ticketId: a, ticketType: 'task', claimantId, settlement: completion }], 3));
  if (prepared.kind !== 'prepared') throw new Error('Expected prepared Settlement');
  // Supplemental trusted-internal capture test, not an ordinary caller constructor.
  const envelope = structuredClone(prepared.change) as typeof prepared.change;
  const stored = envelope.next.tickets[0]!;
  if (stored.status !== 'settled') throw new Error('Expected result');
  const expected = structuredClone(envelope.next);
  mutate = () => { corruptResult(stored.settlement); (envelope.author as { occurredAt: string }).occurredAt = '2020-01-01T00:00:00Z'; };
  const committing = adapter.commit(envelope);
  corruptResult(stored.settlement);
  const committed = await committing;
  if (committed.kind !== 'committed') throw new Error('Expected captured commit');
  expect(committed.revision.state).toEqual(expected);
  expect(committed.revision.author).toEqual(author);
  expect(await adapter.readRevision(mapId, 4)).toEqual({ kind: 'found', value: committed.revision });
  expect(await adapter.readCurrent(mapId)).toEqual({ kind: 'found', value: expected });
});

test('V08: Settlement preparation cannot introduce an unsafe overflow revision or mutate the supplied fixture/storage', async () => {
  const adapter = await setup();
  await commitCommands(adapter, [{ kind: 'claim.acquire', ticketId: a, claimantId }]);
  const before = await observe(adapter, 3);
  const fixture = { ...await current(adapter), currentRevision: Number.MAX_SAFE_INTEGER };
  const input = request([{ kind: 'ticket.settle', ticketId: a, ticketType: 'task', claimantId, settlement: completion }], Number.MAX_SAFE_INTEGER);
  const original = structuredClone([fixture, input]);
  expect(prepareApply(fixture, input)).toMatchObject({ kind: 'rejected', rejection: { stage: 'input', error: { code: 'invalid_input', path: ['expectedRevision'] } } });
  expect([fixture, input]).toEqual(original);
  expect(await observe(adapter, 3)).toEqual(before);
});
