import { expect, test } from 'vitest';
import { calculateFrontier, createMemoryAdapter, decodeApplyRequest, parseId, prepareApply, prepareCreate } from '../src/index.js';
import type { ApplyRequest, Command, MapContent, NonEmpty, StateAdapter, StoredMapState } from '../src/index.js';
import { createMemoryAdapterWithFault } from '../src/memory-adapter.js';

function id<K extends string>(kind: K, value: string) {
  const parsed = parseId(kind, value);
  if (parsed.kind !== 'ok') throw new Error('Invalid fixture ID');
  return parsed.value;
}
const mapId = id('Map', 'Alpha');
const otherId = id('Map', 'Other');
const author = { actorId: id('Actor', 'kun'), clientId: id('Client', 'codex'), occurredAt: '2026-09-18T04:00:00Z' };
const sections = ['fog', 'scopeExclusions'] as const;
type Section = typeof sections[number];
const item = (value = 'item'): MapContent => ({ id: id('Content', value), text: ' Uncertain route \n',
  references: [{ locator: ' opaque:not a URL ♥ ', label: '' }, { locator: ' session:Alpha ' }] });
async function setup(adapter = createMemoryAdapter()) {
  for (const identity of [mapId, otherId]) {
    const prepared = prepareCreate({ id: identity, title: 'Plan', destination: 'Arrive', author });
    if (prepared.kind !== 'ok') throw new Error('Expected creation');
    const committed = await adapter.commit(prepared.value);
    if (committed.kind !== 'committed') throw new Error('Expected create commit');
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
  return structuredClone(await Promise.all([mapId, otherId, id('Map', 'Missing')].map(async identity => ({
    current: await adapter.readCurrent(identity),
    history: await Promise.all(Array.from({ length: head + 1 }, (_, index) => adapter.readRevision(identity, index + 1))),
  }))));
}
async function commitCommands(adapter: StateAdapter, commands: NonEmpty<Command>) {
  const state = await current(adapter);
  const prepared = prepareApply(state, request(commands, state.currentRevision));
  if (prepared.kind !== 'prepared') throw new Error(`Expected preparation: ${JSON.stringify(prepared)}`);
  const committed = await adapter.commit(prepared.change);
  if (committed.kind !== 'committed') throw new Error('Expected commit');
  return committed;
}

test.each(sections)('T08/V07/H01: add %s preserves full text and opaque References in one historical Revision, without changing Frontier', async section => {
  const adapter = await setup();
  const state = await current(adapter);
  const first = await adapter.readRevision(mapId, 1);
  const unrelated = await adapter.readRevision(otherId, 1);
  const raw = { mapId, expectedRevision: 1, author, commands: [{ kind: 'content.add', section, item: item() }] };
  const decoded = decodeApplyRequest(raw);
  expect(decoded.kind).toBe('ok');
  if (decoded.kind !== 'ok') throw new Error('Expected content decoding');
  const prepared = prepareApply(state, decoded.value);
  expect(prepared.kind).toBe('prepared');
  if (prepared.kind !== 'prepared') throw new Error('Expected content preparation');
  expect(prepared.frontier).toEqual([]);
  const next = { ...state, [section]: [item()], currentRevision: 2 };
  const revision = { mapId, revision: 2, priorRevision: 1, kind: 'apply', author,
    changes: [{ commandIndex: 0, command: 'content.add', subjectId: 'item' }], state: next };
  expect(await adapter.commit(prepared.change)).toEqual({ kind: 'committed', revision, frontier: [] });
  expect(await adapter.readCurrent(mapId)).toEqual({ kind: 'found', value: next });
  expect(await adapter.readRevision(mapId, 1)).toEqual(first);
  expect(await adapter.readRevision(mapId, 2)).toEqual({ kind: 'found', value: revision });
  expect(await adapter.readRevision(mapId, 3)).toMatchObject({ kind: 'not_found', code: 'revision_not_found' });
  expect(await adapter.readRevision(otherId, 1)).toEqual(unrelated);
});

const ticket = (value: string) => ({ id: id('Ticket', value), title: `Ticket ${value}`, question: 'Now precise?', type: 'task' as const });
async function setupFog() {
  const adapter = await setup();
  await commitCommands(adapter, [{ kind: 'content.add', section: 'fog', item: item('target') },
    { kind: 'content.add', section: 'scopeExclusions', item: item('excluded') }, { kind: 'ticket.create', ticket: ticket('A') }]);
  return adapter;
}
test('T09/A06/H04: remove precise Fog and create its Ticket atomically, preserving References in the earlier full history', async () => {
  const adapter = await setupFog();
  const initial = await current(adapter);
  const first = await adapter.readRevision(mapId, 1);
  const second = await adapter.readRevision(mapId, 2);
  const unrelated = structuredClone(await Promise.all([adapter.readCurrent(otherId), adapter.readRevision(otherId, 1)]));
  const prepared = prepareApply(initial, request([{ kind: 'content.remove', section: 'fog', itemId: id('Content', 'target') },
    { kind: 'ticket.create', ticket: ticket('B') }], 2));
  if (prepared.kind !== 'prepared') throw new Error('Expected Fog promotion');
  expect(prepared.frontier).toEqual(['A', 'B']);
  expect(await adapter.readCurrent(mapId)).toEqual({ kind: 'found', value: initial });
  const next = { ...initial, fog: [], currentRevision: 3, tickets: [...initial.tickets,
    { ...ticket('B'), extensions: {}, prerequisites: [], status: 'open', claim: null }] };
  const revision = { mapId, revision: 3, priorRevision: 2, kind: 'apply', author,
    changes: [{ commandIndex: 0, command: 'content.remove', subjectId: 'target' },
      { commandIndex: 1, command: 'ticket.create', subjectId: 'B' }], state: next };
  expect(await adapter.commit(prepared.change)).toEqual({ kind: 'committed', revision, frontier: ['A', 'B'] });
  expect(await adapter.readCurrent(mapId)).toEqual({ kind: 'found', value: next });
  expect(await adapter.readRevision(mapId, 1)).toEqual(first);
  expect(await adapter.readRevision(mapId, 2)).toEqual(second);
  expect(second).toMatchObject({ kind: 'found', value: { state: { fog: [item('target')] } } });
  expect(await adapter.readRevision(mapId, 3)).toEqual({ kind: 'found', value: revision });
  expect(await adapter.readRevision(mapId, 4)).toMatchObject({ kind: 'not_found', code: 'revision_not_found' });
  expect(await Promise.all([adapter.readCurrent(otherId), adapter.readRevision(otherId, 1)])).toEqual(unrelated);
});

test.each([
  { command: { kind: 'ticket.create' as const, ticket: ticket('A') }, code: 'ticket_already_exists', ids: ['A'] },
  { command: { kind: 'ticket.update' as const, ticketId: id('Ticket', 'Missing'), patch: { title: 'Next' } }, code: 'ticket_not_found', ids: ['Missing'] },
  { command: { kind: 'content.remove' as const, section: 'fog' as const, itemId: id('Content', 'Missing') }, code: 'content_not_found', ids: [] },
])('T09/A03: valid Fog removal followed by $code preserves old Fog, Frontier and every known Revision', async ({ command, code, ids }) => {
  const adapter = await setupFog();
  const before = await observe(adapter, 2);
  const state = await current(adapter);
  const original = structuredClone(state);
  expect(prepareApply(state, request([{ kind: 'content.remove', section: 'fog', itemId: id('Content', 'target') }, command], 2)))
    .toEqual({ kind: 'rejected', rejection: { stage: 'command', commandIndex: 1, code, ticketIds: ids } });
  expect(state).toEqual(original);
  expect(calculateFrontier(await current(adapter))).toEqual(['A']);
  expect(await observe(adapter, 2)).toEqual(before);
});

test('T09/A02: invalid late Reference payload precedes stale comparison and cannot publish earlier Fog removal', async () => {
  const adapter = await setupFog();
  const before = await observe(adapter, 2);
  const raw = { mapId, expectedRevision: 99, author, commands: [
    { kind: 'content.remove', section: 'fog', itemId: 'target' },
    { kind: 'content.add', section: 'fog', item: { id: 'Next', text: 'Next', references: [{ locator: ' \n' }] } },
  ] };
  const path = ['commands', 1, 'item', 'references', 0, 'locator'];
  expect(decodeApplyRequest(raw)).toMatchObject({ kind: 'error', error: { code: 'invalid_input', path } });
  expect(prepareApply(await current(adapter), raw as unknown as ApplyRequest)).toMatchObject({ kind: 'rejected', rejection: {
    stage: 'input', error: { code: 'invalid_input', path },
  } });
  expect(calculateFrontier(await current(adapter))).toEqual(['A']);
  expect(await observe(adapter, 2)).toEqual(before);
});

test.each(sections)('A07: unchanged, cancelling update and add/remove net-zero edits in %s do not create history', async section => {
  const adapter = await setup();
  await commitCommands(adapter, [{ kind: 'content.add', section, item: item('target') }]);
  const state = await current(adapter);
  const batches: NonEmpty<Command>[] = [
    [{ kind: 'content.update', section, item: item('target') }],
    [{ kind: 'content.update', section, item: { ...item('target'), text: 'Temporary' } }, { kind: 'content.update', section, item: item('target') }],
    [{ kind: 'content.add', section, item: item('Temporary') }, { kind: 'content.remove', section, itemId: id('Content', 'Temporary') }],
    [{ kind: 'content.remove', section, itemId: id('Content', 'target') }, { kind: 'content.add', section, item: item('target') }],
  ];
  for (const commands of batches) {
    const before = await observe(adapter, 2);
    expect(prepareApply(state, request(commands, 2))).toEqual({ kind: 'rejected', rejection: { stage: 'final_state', code: 'no_changes' } });
    expect(await observe(adapter, 2)).toEqual(before);
  }
});

const sparseReferences = new Array(1);
const accessorReferences = Object.defineProperty([{}], '0', { enumerable: true, get() { throw new Error('Must not execute Reference getter'); } });
const hiddenReferences = Object.defineProperty([{}], '0', { enumerable: false, value: { locator: 'source' } });
const extraReferences = Object.assign([], { extra: 'unsupported' });
const symbolReferences = Object.assign([], { [Symbol('extra')]: 'unsupported' });
class NonplainReference { locator = 'source'; }
const invalidItems: { label: string; value: unknown; path: (string | number)[] }[] = [
  { label: 'missing item', value: undefined, path: [] }, { label: 'null item', value: null, path: [] },
  { label: 'array item', value: [], path: [] }, { label: 'Date item', value: new Date(0), path: [] },
  { label: 'missing ID', value: { text: 'Next', references: [] }, path: ['id'] },
  { label: 'invalid ID', value: { ...item(), id: 'bad id' }, path: ['id'] },
  { label: 'missing text', value: { id: 'item', references: [] }, path: ['text'] },
  { label: 'blank text', value: { ...item(), text: ' \n\t' }, path: ['text'] },
  { label: 'nonstring text', value: { ...item(), text: 12 }, path: ['text'] },
  { label: 'text getter', value: Object.defineProperty({ ...item() }, 'text', { enumerable: true, get() { throw new Error('Must not execute text getter'); } }), path: ['text'] },
  ...(['transcript', 'extensions', 'claim', 'introducedAtRevision'] as const).map(key => ({ label: `unsupported item ${key}`,
    value: { ...item(), [key]: [] }, path: [key] })),
  { label: 'missing References', value: { id: 'item', text: 'Next' }, path: ['references'] },
  { label: 'null References', value: { ...item(), references: null }, path: ['references'] },
  { label: 'nonarray References', value: { ...item(), references: { locator: 'source' } }, path: ['references'] },
  { label: 'sparse References', value: { ...item(), references: sparseReferences }, path: ['references', 0] },
  { label: 'Reference element getter', value: { ...item(), references: accessorReferences }, path: ['references', 0] },
  { label: 'hidden Reference element', value: { ...item(), references: hiddenReferences }, path: ['references', 0] },
  { label: 'extra Reference array field', value: { ...item(), references: extraReferences }, path: ['references', 'extra'] },
  { label: 'symbol Reference array field', value: { ...item(), references: symbolReferences }, path: ['references', 'Symbol(extra)'] },
  { label: 'Reference array subclass', value: { ...item(), references: new (class extends Array {})() }, path: ['references'] },
  { label: 'null Reference', value: { ...item(), references: [null] }, path: ['references', 0] },
  { label: 'nonplain Reference', value: { ...item(), references: [new NonplainReference()] }, path: ['references', 0] },
  { label: 'missing locator', value: { ...item(), references: [{}] }, path: ['references', 0, 'locator'] },
  { label: 'blank locator', value: { ...item(), references: [{ locator: '\n\t ' }] }, path: ['references', 0, 'locator'] },
  { label: 'nonstring locator', value: { ...item(), references: [{ locator: 99 }] }, path: ['references', 0, 'locator'] },
  { label: 'locator getter', value: { ...item(), references: [Object.defineProperty({}, 'locator', { enumerable: true, get() { throw new Error('Must not execute locator getter'); } })] }, path: ['references', 0, 'locator'] },
  { label: 'unknown Reference field', value: { ...item(), references: [{ locator: 'source', id: 'ref-id' }] }, path: ['references', 0, 'id'] },
  { label: 'nonstring label', value: { ...item(), references: [{ locator: 'source', label: 10 }] }, path: ['references', 0, 'label'] },
  { label: 'undefined supplied label', value: { ...item(), references: [{ locator: 'source', label: undefined }] }, path: ['references', 0, 'label'] },
];
test.each(sections.flatMap(section => (['content.add', 'content.update'] as const).flatMap(kind => invalidItems.map(entry => ({ section, kind, ...entry })))))
  ('V03/V04/V07/A02: $kind in $section rejects $label through raw and typed seams before stale comparison', async ({ section, kind, value, path }) => {
    const adapter = await setupFog();
    const before = await observe(adapter, 2);
    const raw = { mapId, expectedRevision: 99, author, commands: [
      { kind: 'content.remove', section: 'fog', itemId: 'target' }, { kind, section, item: value },
    ] };
    const expectedPath = ['commands', 1, 'item', ...path];
    expect(decodeApplyRequest(raw)).toMatchObject({ kind: 'error', error: { code: 'invalid_input', path: expectedPath } });
    expect(prepareApply(await current(adapter), raw as unknown as ApplyRequest)).toMatchObject({ kind: 'rejected', rejection: {
      stage: 'input', error: { code: 'invalid_input', path: expectedPath },
    } });
    expect(calculateFrontier(await current(adapter))).toEqual(['A']);
    expect(await observe(adapter, 2)).toEqual(before);
  });

const invalidCommands: { label: string; command: unknown; path: (string | number)[] }[] = [
  ...(['content.add', 'content.update', 'content.remove'] as const).flatMap(kind => [
    { label: `${kind} invalid section`, command: { kind, section: 'Fog', ...(kind === 'content.remove' ? { itemId: 'item' } : { item: item() }) }, path: ['section'] },
    { label: `${kind} missing section`, command: { kind, ...(kind === 'content.remove' ? { itemId: 'item' } : { item: item() }) }, path: ['section'] },
    { label: `${kind} unknown access`, command: { kind, section: 'fog', ...(kind === 'content.remove' ? { itemId: 'item' } : { item: item() }), claimantId: 'session' }, path: ['claimantId'] },
  ]),
  ...sections.flatMap(section => [
    { label: `remove ${section} missing ID`, command: { kind: 'content.remove', section }, path: ['itemId'] },
    { label: `remove ${section} invalid ID`, command: { kind: 'content.remove', section, itemId: '' }, path: ['itemId'] },
    { label: `remove ${section} forbidden item`, command: { kind: 'content.remove', section, itemId: 'item', item: item() }, path: ['item'] },
  ]),
  ...(['ticket.delete', 'map.delete', 'map.rollback'] as const).map(kind => ({ label: `deferred ${kind}`, command: { kind }, path: ['kind'] })),
];
test.each(invalidCommands)('V03/V04/A02: $label does not publish earlier content mutation', async ({ command, path }) => {
  const adapter = await setupFog();
  const before = await observe(adapter, 2);
  const raw = { mapId, expectedRevision: 2, author, commands: [
    { kind: 'content.remove', section: 'fog', itemId: 'target' }, command,
  ] };
  const expectedPath = ['commands', 1, ...path];
  expect(decodeApplyRequest(raw)).toMatchObject({ kind: 'error', error: { code: 'invalid_input', path: expectedPath } });
  expect(prepareApply(await current(adapter), raw as unknown as ApplyRequest)).toMatchObject({ kind: 'rejected', rejection: {
    stage: 'input', error: { code: 'invalid_input', path: expectedPath },
  } });
  expect(await observe(adapter, 2)).toEqual(before);
});

test.each(sections)('T08/V07: %s accepts empty References and plain null-prototype objects; update can clear all References', async section => {
  const adapter = await setup();
  const plain = Object.assign(Object.create(null) as Record<string, unknown>, { id: 'target', text: ' Text preserved\n', references: [] });
  const decoded = decodeApplyRequest({ mapId, expectedRevision: 1, author, commands: [{ kind: 'content.add', section, item: plain }] });
  if (decoded.kind !== 'ok') throw new Error('Expected plain null-prototype item');
  const prepared = prepareApply(await current(adapter), decoded.value);
  if (prepared.kind !== 'prepared') throw new Error('Expected minimal content');
  expect(await adapter.commit(prepared.change)).toMatchObject({ kind: 'committed', revision: { state: {
    [section]: [{ id: 'target', text: ' Text preserved\n', references: [] }],
  } } });
  const reference = Object.assign(Object.create(null) as Record<string, unknown>, { locator: ' opaque source ♥ ', label: ' Label retained ' });
  const rawUpdate = { mapId, expectedRevision: 2, author, commands: [{ kind: 'content.update', section,
    item: { id: 'target', text: 'Next', references: [reference] } }] };
  const update = decodeApplyRequest(rawUpdate);
  if (update.kind !== 'ok') throw new Error('Expected plain null-prototype Reference');
  const updated = await commitCommands(adapter, update.value.commands);
  expect(updated.revision.state[section]).toEqual([{ id: 'target', text: 'Next', references: [{ locator: ' opaque source ♥ ', label: ' Label retained ' }] }]);
  const cleared = await commitCommands(adapter, [{ kind: 'content.update', section, item: { id: id('Content', 'target'), text: 'Next', references: [] } }]);
  expect(cleared.revision.state[section]).toEqual([{ id: 'target', text: 'Next', references: [] }]);
  expect(await adapter.readRevision(mapId, 3)).toEqual({ kind: 'found', value: updated.revision });
});

test.each(sections.flatMap(section => (['typed', 'decoded'] as const).map(boundary => ({ section, boundary }))))(
  'S10: nested Reference mutation through $boundary input, current/prepared/read/commit outputs in $section cannot alias history', async ({ section, boundary }) => {
    const adapter = await setup();
    const original = { id: id('Content', 'target'), text: 'Original', references: [{ locator: 'source', label: 'Label' }] };
    const raw = request([{ kind: 'content.add', section, item: original }]);
    const decoded = decodeApplyRequest(raw);
    if (decoded.kind !== 'ok') throw new Error('Expected decode');
    const state = await current(adapter);
    const prepared = prepareApply(state, boundary === 'typed' ? raw : decoded.value);
    if (prepared.kind !== 'prepared') throw new Error('Expected preparation');
    original.references[0]!.locator = 'Corrupted caller locator';
    original.references.push({ locator: 'Additional', label: 'Additional' });
    original.text = 'Corrupted caller text';
    const expectedItem = { id: 'target', text: 'Original', references: [{ locator: 'source', label: 'Label' }] };
    const committed = await adapter.commit(prepared.change);
    if (committed.kind !== 'committed') throw new Error('Expected commit');
    const historical = await adapter.readRevision(mapId, 2);
    if (historical.kind !== 'found') throw new Error('Expected history');
    const head = await current(adapter);
    const before = await observe(adapter, 2);
    for (const view of [prepared.change.next, committed.revision.state, historical.value.state, head]) {
      expect(view[section]).toEqual([expectedItem]);
      Reflect.set(view[section], '0', item('Corrupted'));
      Reflect.set(view[section][0]!, 'text', 'Corrupted');
      Reflect.set(view[section][0]!.references, '0', { locator: 'Corrupted' });
      Reflect.set(view[section][0]!.references[0]!, 'locator', 'Corrupted');
      Reflect.set(view[section][0]!.references[0]!, 'label', 'Corrupted');
    }
    expect(state.fog).toEqual([]);
    expect(state.scopeExclusions).toEqual([]);
    expect(await observe(adapter, 2)).toEqual(before);
    // A detached supplied current is mutable, but preparation must capture it.
    const supplied = structuredClone(head);
    const next = prepareApply(supplied, request([{ kind: 'map.update', patch: { notes: 'Next' } }], 2));
    if (next.kind !== 'prepared') throw new Error('Expected second preparation');
    Reflect.set(supplied[section][0]!.references[0]!, 'locator', 'Corrupted supplied current');
    const later = await adapter.commit(next.change);
    if (later.kind !== 'committed') throw new Error('Expected later commit');
    expect(later.revision.state[section]).toEqual([expectedItem]);
    expect(await adapter.readRevision(mapId, 2)).toEqual({ kind: 'found', value: committed.revision });
  },
);

test.each(sections)('S11: commit invocation captures nested %s References before the caller can change a trusted internal envelope', async section => {
  const adapter = await setup();
  const prepared = prepareApply(await current(adapter), request([{ kind: 'content.add', section, item: item('target') }]));
  if (prepared.kind !== 'prepared') throw new Error('Expected graph preparation');
  const internal = structuredClone(prepared.change);
  const pending = adapter.commit(internal);
  Reflect.set(internal.next[section][0]!.references[0]!, 'locator', 'Corrupted after invocation');
  Reflect.set(internal.next[section], '0', item('Corrupted'));
  const committed = await pending;
  if (committed.kind !== 'committed') throw new Error('Expected captured commit');
  expect(committed.revision.state[section]).toEqual([item('target')]);
  expect((await current(adapter))[section]).toEqual([item('target')]);
  expect(await adapter.readRevision(mapId, 2)).toEqual({ kind: 'found', value: committed.revision });
});

test('S09/T09: pre-publication failure during Fog promotion leaves both Maps, all history and old Frontier untouched', async () => {
  let fail = false;
  const adapter = await setup(createMemoryAdapterWithFault(() => { if (fail) throw new Error('Publication failed'); }));
  await commitCommands(adapter, [{ kind: 'content.add', section: 'fog', item: item('target') }, { kind: 'ticket.create', ticket: ticket('A') }]);
  const other = await current(adapter, otherId);
  const otherPrepared = prepareApply(other, { ...request([{ kind: 'content.add', section: 'scopeExclusions', item: item('other-content') }]), mapId: otherId });
  if (otherPrepared.kind !== 'prepared') throw new Error('Expected other Map preparation');
  await adapter.commit(otherPrepared.change);
  const before = await observe(adapter, 2);
  const prepared = prepareApply(await current(adapter), request([{ kind: 'content.remove', section: 'fog', itemId: id('Content', 'target') },
    { kind: 'ticket.create', ticket: ticket('B') }], 2));
  if (prepared.kind !== 'prepared') throw new Error('Expected promotion preparation');
  fail = true;
  await expect(adapter.commit(prepared.change)).rejects.toThrow('Publication failed');
  expect(calculateFrontier(await current(adapter))).toEqual(['A']);
  expect(await observe(adapter, 2)).toEqual(before);
  fail = false;
  expect(await adapter.commit(prepared.change)).toMatchObject({ kind: 'committed', frontier: ['A', 'B'] });
});

test.each(sections)('S07: stale %s update commit cannot overwrite winner References or add an extra Revision', async section => {
  const adapter = await setup();
  await commitCommands(adapter, [{ kind: 'content.add', section, item: item('target') }]);
  const state = await current(adapter);
  const proposals = ['Winner', 'Loser'].map(text => prepareApply(state, request([{ kind: 'content.update', section,
    item: { id: id('Content', 'target'), text, references: [{ locator: `opaque:${text}` }] } }], 2)));
  if (proposals[0]?.kind !== 'prepared' || proposals[1]?.kind !== 'prepared') throw new Error('Expected two proposals');
  const winner = await adapter.commit(proposals[0].change);
  if (winner.kind !== 'committed') throw new Error('Expected winner');
  const before = await observe(adapter, 3);
  expect(await adapter.commit(proposals[1].change)).toEqual({ kind: 'conflict', conflict: { mapId, expectedRevision: 2, currentRevision: 3 } });
  expect(await observe(adapter, 3)).toEqual(before);
  const pinned = structuredClone(winner);
  await commitCommands(adapter, [{ kind: 'content.update', section, item: { id: id('Content', 'target'), text: 'Later', references: [] } }]);
  expect(winner).toEqual(pinned);
  expect(winner.revision.state[section]).toEqual([{ id: 'target', text: 'Winner', references: [{ locator: 'opaque:Winner' }] }]);
  expect(await adapter.readRevision(mapId, 3)).toEqual({ kind: 'found', value: winner.revision });
});

test.each(sections)('V03/T08: ContentIds are local to each Map; constructor/toString work normally in %s', async section => {
  const adapter = await setup();
  const commands: NonEmpty<Command> = [{ kind: 'content.add', section, item: item('constructor') },
    { kind: 'content.add', section, item: item('toString') }];
  const first = await commitCommands(adapter, commands);
  const other = await current(adapter, otherId);
  const prepared = prepareApply(other, { ...request(commands), mapId: otherId });
  if (prepared.kind !== 'prepared') throw new Error('Expected local reuse in another Map');
  const second = await adapter.commit(prepared.change);
  if (second.kind !== 'committed') throw new Error('Expected other Map commit');
  expect(first.revision.state[section]).toEqual([item('constructor'), item('toString')]);
  expect(second.revision.state[section]).toEqual([item('constructor'), item('toString')]);
  expect(await adapter.readRevision(mapId, 2)).toEqual({ kind: 'found', value: first.revision });
});

test.each(sections)('T09: %s items never enter Frontier or qualify as Dependency endpoints; content/Ticket ID spaces remain distinct', async section => {
  const adapter = await setup();
  const first = await commitCommands(adapter, [{ kind: 'content.add', section, item: item('FogOnly') }, { kind: 'ticket.create', ticket: ticket('A') },
    { kind: 'content.add', section, item: item('A') }]);
  expect(first.frontier).toEqual(['A']);
  const before = await observe(adapter, 2);
  expect(prepareApply(await current(adapter), request([{ kind: 'dependency.add', dependentId: id('Ticket', 'A'), prerequisiteId: id('Ticket', 'FogOnly') }], 2)))
    .toEqual({ kind: 'rejected', rejection: { stage: 'command', commandIndex: 0, code: 'ticket_not_found', ticketIds: ['FogOnly'] } });
  expect(await observe(adapter, 2)).toEqual(before);
});

const invalidArrayShapes: { label: string; build: (element: unknown) => unknown[]; path: (string | number)[] }[] = [
  { label: 'sparse', build: () => new Array(1), path: [0] },
  { label: 'accessor element', build: () => Object.defineProperty([{}], '0', { enumerable: true, get() { throw new Error('Must not execute array getter'); } }), path: [0] },
  { label: 'hidden element', build: element => Object.defineProperty([element], '0', { enumerable: false, value: element }), path: [0] },
  { label: 'extra field', build: element => Object.assign([element], { meta: 'unsupported' }), path: ['meta'] },
  { label: 'symbol field', build: element => Object.assign([element], { [Symbol('extra')]: 'unsupported' }), path: ['Symbol(extra)'] },
  { label: 'noncanonical index', build: element => Object.assign([element], { '00': 'unsupported' }), path: ['00'] },
  { label: 'newline-suffixed index', build: element => Object.assign([element], { '0\n': 'unsupported' }), path: ['0\n'] },
  { label: 'subclass', build: element => { const array = new (class extends Array<unknown> {})(); array.push(element); return array; }, path: [] },
];
test.each((['commands', 'References', 'JSON extensions'] as const).flatMap(boundary => invalidArrayShapes.map(entry => ({ boundary, ...entry }))))
  ('V04/V05/V07/A02: $boundary rejects $label with consistent array-shape checks and no partial effects', async ({ boundary, build, path }) => {
    const adapter = await setupFog();
    const before = await observe(adapter, 2);
    let raw: unknown;
    let expectedPath: (string | number)[];
    if (boundary === 'commands') {
      raw = { mapId, expectedRevision: 99, author, commands: build({ kind: 'content.remove', section: 'fog', itemId: 'target' }) };
      expectedPath = ['commands', ...path];
    } else {
      const command = boundary === 'References'
        ? { kind: 'content.update', section: 'fog', item: { id: 'target', text: 'Changed', references: build({ locator: 'source' }) } }
        : { kind: 'map.update', patch: { extensions: { 'app.list': build(1) } } };
      raw = { mapId, expectedRevision: 99, author, commands: [{ kind: 'content.remove', section: 'fog', itemId: 'target' }, command] };
      expectedPath = boundary === 'References' ? ['commands', 1, 'item', 'references', ...path]
        : ['commands', 1, 'patch', 'extensions', 'app.list', ...path];
    }
    expect(decodeApplyRequest(raw)).toMatchObject({ kind: 'error', error: { code: 'invalid_input', path: expectedPath } });
    expect(prepareApply(await current(adapter), raw as ApplyRequest)).toMatchObject({ kind: 'rejected', rejection: {
      stage: 'input', error: { code: 'invalid_input', path: expectedPath },
    } });
    expect(await observe(adapter, 2)).toEqual(before);
  });

test.each(sections)('T08/H01/H04: update and remove %s replace the whole item, retain identity/section and preserve every full prior snapshot', async section => {
  const adapter = await setup();
  const initial = await current(adapter);
  const first = await adapter.readRevision(mapId, 1);
  const opposite: Section = section === 'fog' ? 'scopeExclusions' : 'fog';
  const added = await commitCommands(adapter, [
    { kind: 'content.add', section, item: item('target') }, { kind: 'content.add', section, item: item('keep') },
    { kind: 'content.add', section: opposite, item: item('other-section') },
  ]);
  const expectedAdded = { ...initial, [section]: [item('target'), item('keep')], [opposite]: [item('other-section')], currentRevision: 2 };
  expect(added.revision.state).toEqual(expectedAdded);
  const replacement = { id: id('Content', 'target'), text: ' Updated\n', references: [{ locator: 'URN:anything', label: ' changed ' }] };
  const updated = await commitCommands(adapter, [{ kind: 'content.update', section, item: replacement }]);
  const expectedUpdated = { ...expectedAdded, [section]: [replacement, item('keep')], currentRevision: 3 };
  expect(updated.revision.state).toEqual(expectedUpdated);
  expect(updated.revision.changes).toEqual([{ commandIndex: 0, command: 'content.update', subjectId: 'target' }]);
  const removed = await commitCommands(adapter, [{ kind: 'content.remove', section, itemId: id('Content', 'target') }]);
  const expectedRemoved = { ...expectedUpdated, [section]: [item('keep')], currentRevision: 4 };
  expect(removed.revision.state).toEqual(expectedRemoved);
  expect(removed.revision.changes).toEqual([{ commandIndex: 0, command: 'content.remove', subjectId: 'target' }]);
  for (const result of [added, updated, removed]) {
    expect(result.frontier).toEqual([]);
    expect(result.revision.priorRevision).toBe(result.revision.revision - 1);
    expect(await adapter.readRevision(mapId, result.revision.revision)).toEqual({ kind: 'found', value: result.revision });
  }
  expect(await adapter.readRevision(mapId, 1)).toEqual(first);
  expect(await adapter.readCurrent(mapId)).toEqual({ kind: 'found', value: expectedRemoved });
  expect(await adapter.readRevision(mapId, 5)).toMatchObject({ kind: 'not_found', code: 'revision_not_found' });
  expect(await adapter.readCurrent(otherId)).toEqual({ kind: 'found', value: { ...initial, id: otherId } });
});

test.each(sections.flatMap(storedSection => sections.map(section => ({ storedSection, section }))))(
  'T08/A03: duplicate ContentId in $storedSection rejects adding to $section, even after an earlier valid mutation', async ({ storedSection, section }) => {
    const adapter = await setup();
    await commitCommands(adapter, [{ kind: 'content.add', section: storedSection, item: item('target') }]);
    const before = await observe(adapter, 2);
    expect(prepareApply(await current(adapter), request([{ kind: 'map.update', patch: { title: 'Never publish' } },
      { kind: 'content.add', section, item: { ...item('target'), text: 'Different' } }], 2))).toEqual({ kind: 'rejected', rejection: {
      stage: 'command', commandIndex: 1, code: 'content_already_exists', ticketIds: [],
    } });
    expect(await observe(adapter, 2)).toEqual(before);
  },
);

test.each(sections.flatMap(section => (['content.update', 'content.remove'] as const).flatMap(kind => [
  { section, kind, target: 'Missing', label: 'missing' }, { section, kind, target: 'WrongSection', label: 'wrong section' },
])))('T08/A03: $kind $label target in $section rejects without changing current/known history/other Maps', async ({ section, kind, target }) => {
  const adapter = await setup();
  const opposite: Section = section === 'fog' ? 'scopeExclusions' : 'fog';
  await commitCommands(adapter, [{ kind: 'content.add', section: opposite, item: item('WrongSection') }]);
  const before = await observe(adapter, 2);
  const command = kind === 'content.update' ? { kind, section, item: item(target) } : { kind, section, itemId: id('Content', target) };
  expect(prepareApply(await current(adapter), request([{ kind: 'content.add', section, item: item('WouldAdd') }, command], 2)))
    .toEqual({ kind: 'rejected', rejection: { stage: 'command', commandIndex: 1, code: 'content_not_found', ticketIds: [] } });
  expect(await observe(adapter, 2)).toEqual(before);
});
