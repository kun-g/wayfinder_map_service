import { expect, test } from 'vitest';
import { createMemoryAdapter, decodeApplyRequest, parseId, prepareCreate, prepareApply } from '../src/index.js';
import type { ApplyRequest, MapPatch, PreparedCommit, StateAdapter, StoredMapState } from '../src/index.js';
import { createMemoryAdapterWithFault } from '../src/memory-adapter.js';

function id<K extends string>(kind: K, value: string) {
  const result = parseId(kind, value);
  if (result.kind !== 'ok') throw new Error('Invalid fixture identity');
  return result.value;
}
const mapId = id('Map', 'Alpha');
const otherId = id('Map', 'Other');
const author = { actorId: id('Actor', 'kun'), clientId: id('Client', 'codex'), occurredAt: '2026-09-18T04:00:00Z' };

async function setup(adapter = createMemoryAdapter()) {
  for (const identity of [mapId, otherId]) {
    const prepared = prepareCreate({ id: identity, title: 'Original', destination: 'Arrive',
      notes: 'Keep notes', extensions: { 'app.old': { keep: true }, 'app.second': 'old' }, author });
    if (prepared.kind !== 'ok') throw new Error('Expected create preparation');
    await adapter.commit(prepared.value);
  }
  return adapter;
}
async function current(adapter: StateAdapter): Promise<StoredMapState> {
  const read = await adapter.readCurrent(mapId);
  if (read.kind !== 'found') throw new Error('Expected current state');
  return read.value;
}
function request(patch: MapPatch = { title: 'Changed' }, expectedRevision = 1): ApplyRequest {
  return { mapId, expectedRevision, author, commands: [{ kind: 'map.update', patch }] };
}
async function observe(adapter: StateAdapter, head = 1) {
  return structuredClone(await Promise.all([mapId, otherId, id('Map', 'Missing')].map(async (identity) => ({
    current: await adapter.readCurrent(identity),
    history: await Promise.all(Array.from({ length: head + 1 }, (_, i) => adapter.readRevision(identity, i + 1))),
  }))));
}

test('A06/H01: ordered Map updates commit once, retain full Revision 1 and replace only supplied fields', async () => {
  const adapter = await setup();
  const first = await adapter.readRevision(mapId, 1);
  const unrelated = await adapter.readCurrent(otherId);
  const state = await current(adapter);
  const prepared = prepareApply(state, { mapId, expectedRevision: 1, author, commands: [
    { kind: 'map.update', patch: { title: 'Intermediate', extensions: { 'app.new': { value: [1, null] } } } },
    { kind: 'map.update', patch: { title: ' Final ', destination: ' Next\n', notes: '' } },
  ] });
  expect(prepared.kind).toBe('prepared');
  if (prepared.kind !== 'prepared') throw new Error('Expected apply preparation');
  expect(await adapter.readCurrent(mapId)).toEqual({ kind: 'found', value: state });
  const result = await adapter.commit(prepared.change);
  const next = { ...state, title: ' Final ', destination: ' Next\n', notes: '',
    extensions: { 'app.new': { value: [1, null] } }, currentRevision: 2 };
  const revision = { mapId, revision: 2, priorRevision: 1, kind: 'apply', author,
    changes: [
      { commandIndex: 0, command: 'map.update', subjectId: 'Alpha' },
      { commandIndex: 1, command: 'map.update', subjectId: 'Alpha' },
    ], state: next };
  expect(result).toEqual({ kind: 'committed', revision, frontier: [] });
  expect(await adapter.readCurrent(mapId)).toEqual({ kind: 'found', value: next });
  expect(await adapter.readRevision(mapId, 2)).toEqual({ kind: 'found', value: revision });
  expect(await adapter.readRevision(mapId, 1)).toEqual(first);
  expect(await adapter.readRevision(mapId, 3)).toMatchObject({ kind: 'not_found', code: 'revision_not_found' });
  expect(await adapter.readCurrent(otherId)).toEqual(unrelated);
});

const invalidCases: { label: string; raw: unknown; path: (string | number)[] }[] = [
  { label: 'null request', raw: null, path: [] },
  { label: 'array request', raw: [], path: [] },
  { label: 'unknown request field', raw: { ...request(), workspace: 'private' }, path: ['workspace'] },
  { label: 'missing Map identity', raw: { ...request(), mapId: undefined }, path: ['mapId'] },
  { label: 'invalid Map identity', raw: { ...request(), mapId: ' Alpha' }, path: ['mapId'] },
  { label: 'missing author', raw: { ...request(), author: undefined }, path: ['author'] },
  { label: 'invalid ActorId', raw: { ...request(), author: { ...author, actorId: 'bad id' } }, path: ['author', 'actorId'] },
  { label: 'invalid ClientId', raw: { ...request(), author: { ...author, clientId: '' } }, path: ['author', 'clientId'] },
  { label: 'invalid timestamp', raw: { ...request(), author: { ...author, occurredAt: '2026-02-30T00:00:00Z' } }, path: ['author', 'occurredAt'] },
  { label: 'non-UTC timestamp', raw: { ...request(), author: { ...author, occurredAt: '2026-09-18T12:00:00+08:00' } }, path: ['author', 'occurredAt'] },
  { label: 'unknown author field', raw: { ...request(), author: { ...author, claim: 'session' } }, path: ['author', 'claim'] },
  { label: 'missing commands', raw: { ...request(), commands: undefined }, path: ['commands'] },
  { label: 'non-array commands', raw: { ...request(), commands: {} }, path: ['commands'] },
  { label: 'empty batch', raw: { ...request(), commands: [] }, path: ['commands'] },
  { label: 'sparse batch', raw: { ...request(), commands: new Array(1) }, path: ['commands', 0] },
  { label: 'unknown command', raw: { ...request(), commands: [{ kind: 'map.delete' }] }, path: ['commands', 0, 'kind'] },
  { label: 'unknown command field', raw: { ...request(), commands: [{ kind: 'map.update', patch: { title: 'Next' }, claim: 'session' }] }, path: ['commands', 0, 'claim'] },
  { label: 'missing patch', raw: { ...request(), commands: [{ kind: 'map.update' }] }, path: ['commands', 0, 'patch'] },
  { label: 'empty patch', raw: request({}), path: ['commands', 0, 'patch'] },
  { label: 'blank title', raw: request({ title: '\n ' }), path: ['commands', 0, 'patch', 'title'] },
  { label: 'blank Destination', raw: request({ destination: ' \t' }), path: ['commands', 0, 'patch', 'destination'] },
  { label: 'non-string Notes', raw: request({ notes: null } as unknown as MapPatch), path: ['commands', 0, 'patch', 'notes'] },
  { label: 'unknown patch field', raw: request({ id: 'Another' } as unknown as MapPatch), path: ['commands', 0, 'patch', 'id'] },
  { label: 'undefined supplied title', raw: request({ title: undefined } as unknown as MapPatch), path: ['commands', 0, 'patch', 'title'] },
  { label: 'undefined supplied extensions', raw: request({ extensions: undefined } as unknown as MapPatch), path: ['commands', 0, 'patch', 'extensions'] },
];

test.each(invalidCases)('A02: $label fails raw and typed validation, never publishing', async ({ raw, path }) => {
  const adapter = await setup();
  const before = await observe(adapter);
  expect(decodeApplyRequest(raw)).toMatchObject({ kind: 'error', error: { code: 'invalid_input', path } });
  expect(prepareApply(await current(adapter), raw as ApplyRequest)).toMatchObject({
    kind: 'rejected', rejection: { stage: 'input', error: { code: 'invalid_input', path } },
  });
  expect(await observe(adapter)).toEqual(before);
});

test.each([0, -1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, '1', null, undefined])(
  'V08: invalid expected revision %s fails raw and typed validation without changing Maps/history', async (expectedRevision) => {
    const adapter = await setup();
    const before = await observe(adapter);
    const raw = { ...request(), expectedRevision };
    expect(decodeApplyRequest(raw)).toMatchObject({ kind: 'error', error: { code: 'invalid_input', path: ['expectedRevision'] } });
    expect(prepareApply(await current(adapter), raw as ApplyRequest)).toMatchObject({
      kind: 'rejected', rejection: { stage: 'input', error: { code: 'invalid_input', path: ['expectedRevision'] } },
    });
    expect(await observe(adapter)).toEqual(before);
  },
);

test('A02: malformed late payload rejects before stale comparison or execution of earlier valid payload', async () => {
  const adapter = await setup();
  const state = await current(adapter);
  const before = await observe(adapter);
  const raw = { ...request(), expectedRevision: 2, commands: [
    { kind: 'map.update', patch: { title: 'Would change' } },
    { kind: 'map.update', patch: { destination: ' ' } },
  ] } as ApplyRequest;
  expect(prepareApply(state, raw)).toMatchObject({ kind: 'rejected', rejection: {
    stage: 'input', error: { code: 'invalid_input', path: ['commands', 1, 'patch', 'destination'] },
  } });
  expect(await observe(adapter)).toEqual(before);
});

test('A05: identity mismatch is invalid input and stale supplied head is a structured Conflict', async () => {
  const adapter = await setup();
  const state = await current(adapter);
  const before = await observe(adapter);
  expect(prepareApply(state, { ...request(), mapId: otherId })).toMatchObject({ kind: 'rejected', rejection: {
    stage: 'input', error: { code: 'invalid_input', path: ['mapId'] },
  } });
  expect(await observe(adapter)).toEqual(before);
  expect(prepareApply(state, request({ title: 'Changed' }, 2))).toEqual({
    kind: 'conflict', conflict: { mapId: 'Alpha', expectedRevision: 2, currentRevision: 1 },
  });
  expect(await observe(adapter)).toEqual(before);
});

test.each([
  request({ title: 'Original' }), request({ destination: 'Arrive' }), request({ notes: 'Keep notes' }),
  request({ extensions: { 'app.second': 'old', 'app.old': { keep: true } } }),
  { ...request(), author: { ...author, occurredAt: '2025-01-01T00:00:00Z' }, commands: [
    { kind: 'map.update', patch: { title: 'Changed' } }, { kind: 'map.update', patch: { title: 'Original' } },
  ] },
] as ApplyRequest[])('A07: unchanged/cancelling content cannot manufacture history (%#)', async (submitted) => {
  const adapter = await setup();
  const before = await observe(adapter);
  expect(prepareApply(await current(adapter), submitted)).toEqual({
    kind: 'rejected', rejection: { stage: 'final_state', code: 'no_changes' },
  });
  expect(await observe(adapter)).toEqual(before);
});

test('V08: safe head boundary can prepare MAX_SAFE_INTEGER, but overflow is rejected without wrapping', async () => {
  const adapter = await setup();
  const real = await current(adapter);
  const before = await observe(adapter);
  const maximum = Number.MAX_SAFE_INTEGER;
  const last = prepareApply({ ...real, currentRevision: maximum - 1 }, request({ title: 'Last' }, maximum - 1));
  expect(last).toMatchObject({ kind: 'prepared', change: { priorRevision: maximum - 1, next: { currentRevision: maximum } } });
  expect(prepareApply({ ...real, currentRevision: maximum }, request({ title: 'Overflow' }, maximum))).toMatchObject({
    kind: 'rejected', rejection: { stage: 'input', error: { code: 'invalid_input', path: ['expectedRevision'] } },
  });
  expect(await observe(adapter)).toEqual(before);
});

test('A01: preparation is synchronous and deterministic, mutates neither caller input nor storage', async () => {
  const adapter = await setup();
  const state = structuredClone(await current(adapter));
  const submitted = structuredClone(request());
  const stateBefore = structuredClone(state), requestBefore = structuredClone(submitted);
  const before = await observe(adapter);
  const first = prepareApply(state, submitted);
  expect(first.kind).toBe('prepared');
  expect(first).not.toBeInstanceOf(Promise);
  expect(prepareApply(state, submitted)).toEqual(first);
  expect(state).toEqual(stateBefore);
  expect(submitted).toEqual(requestBefore);
  expect(await observe(adapter)).toEqual(before);
});

test('S04: competing prepared writers are compared again at commit, with exactly one winner and no losing history', async () => {
  const adapter = await setup();
  const state = await current(adapter);
  const old = await adapter.readRevision(mapId, 1);
  const unrelated = await adapter.readCurrent(otherId);
  const proposals = ['First proposal', 'Second proposal'].map((title) => prepareApply(state, request({ title })));
  const results = await Promise.all(proposals.map((proposal) => {
    if (proposal.kind !== 'prepared') throw new Error('Expected preparation');
    return adapter.commit(proposal.change);
  }));
  expect(results.map((result) => result.kind).sort()).toEqual(['committed', 'conflict']);
  const winner = results.find((result) => result.kind === 'committed');
  if (!winner || winner.kind !== 'committed') throw new Error('Expected winner');
  expect(results.find((result) => result.kind === 'conflict')).toEqual({
    kind: 'conflict', conflict: { mapId: 'Alpha', expectedRevision: 1, currentRevision: 2 },
  });
  expect(await adapter.readCurrent(mapId)).toEqual({ kind: 'found', value: winner.revision.state });
  expect(await adapter.readRevision(mapId, 2)).toEqual({ kind: 'found', value: winner.revision });
  expect(await adapter.readRevision(mapId, 3)).toMatchObject({ kind: 'not_found', code: 'revision_not_found' });
  expect(await adapter.readRevision(mapId, 1)).toEqual(old);
  expect(await adapter.readCurrent(otherId)).toEqual(unrelated);
});

test('S06: missing target and replay reject without changing any current/history', async () => {
  const source = await setup();
  const empty = createMemoryAdapter();
  const unrelated = prepareCreate({ id: otherId, title: 'Unrelated', destination: 'Arrive', author });
  if (unrelated.kind !== 'ok') throw new Error('Expected unrelated preparation');
  await empty.commit(unrelated.value);
  const beforeEmpty = await observe(empty);
  const proposal = prepareApply(await current(source), request());
  if (proposal.kind !== 'prepared') throw new Error('Expected preparation');
  expect(await empty.commit(proposal.change)).toEqual({ kind: 'rejected', code: 'map_not_found', mapId: 'Alpha' });
  expect(await observe(empty)).toEqual(beforeEmpty);
  expect(await source.commit(proposal.change)).toMatchObject({ kind: 'committed', revision: { revision: 2 } });
  const beforeReplay = await observe(source, 2);
  expect(await source.commit(proposal.change)).toEqual({
    kind: 'conflict', conflict: { mapId: 'Alpha', expectedRevision: 1, currentRevision: 2 },
  });
  expect(await observe(source, 2)).toEqual(beforeReplay);
});

test.each(['create', 'apply'] as const)('S09: %s pre-publication failure publishes nothing in any Map and normal retry remains possible', async (kind) => {
  const failure = new Error('Injected local publication failure');
  let fail = false;
  const adapter = await setup(createMemoryAdapterWithFault(() => { if (fail) throw failure; }));
  const fresh = id('Map', 'Fresh');
  const before = await observe(adapter);
  const absentBefore = await adapter.readCurrent(fresh);
  const prepared = kind === 'create'
    ? prepareCreate({ id: fresh, title: 'Fresh', destination: 'Arrive', author })
    : prepareApply(await current(adapter), request());
  if (prepared.kind !== 'ok' && prepared.kind !== 'prepared') throw new Error('Expected preparation');
  const change = prepared.kind === 'ok' ? prepared.value : prepared.change;
  fail = true;
  await expect(adapter.commit(change)).rejects.toBe(failure);
  expect(await observe(adapter)).toEqual(before);
  expect(await adapter.readCurrent(fresh)).toEqual(absentBefore);
  expect(await adapter.readRevision(fresh, 1)).toMatchObject({ kind: 'not_found', code: 'map_not_found' });
  fail = false;
  expect(await adapter.commit(change)).toMatchObject({ kind: 'committed', revision: { revision: kind === 'create' ? 1 : 2 } });
  expect(Object.keys(adapter).sort()).toEqual(['commit', 'readCurrent', 'readRevision']);
});

test('H01/H04/S07/S08: history stays pinned, authors retain caller time, and commit results never become a later head', async () => {
  const adapter = await setup();
  const first = await adapter.readRevision(mapId, 1);
  const results = [];
  const beforeOther = await adapter.readCurrent(otherId);
  for (const [title, occurredAt] of [
    ['Second', '2020-01-01T00:00:00.123456Z'], ['Third', '2019-01-01t00:00:00z'],
    ['Fourth', '2018-01-01T00:00:00+00:00'],
  ]) {
    const state = await current(adapter);
    const prepared = prepareApply(state, { ...request({ title: title! }, state.currentRevision), author: { ...author, occurredAt: occurredAt! } });
    if (prepared.kind !== 'prepared') throw new Error('Expected preparation');
    results.push(await adapter.commit(prepared.change));
  }
  expect(results).toMatchObject([
    { kind: 'committed', frontier: [], revision: { revision: 2, priorRevision: 1, kind: 'apply', author: { occurredAt: '2020-01-01T00:00:00.123456Z' }, state: { title: 'Second', currentRevision: 2 } } },
    { kind: 'committed', frontier: [], revision: { revision: 3, priorRevision: 2, state: { title: 'Third', currentRevision: 3 } } },
    { kind: 'committed', frontier: [], revision: { revision: 4, priorRevision: 3, state: { title: 'Fourth', currentRevision: 4 } } },
  ]);
  for (const result of results) {
    if (result.kind !== 'committed') throw new Error('Expected commits');
    expect(await adapter.readRevision(mapId, result.revision.revision)).toEqual({ kind: 'found', value: result.revision });
  }
  expect(await adapter.readRevision(mapId, 1)).toEqual(first);
  expect(await adapter.readCurrent(mapId)).toMatchObject({ kind: 'found', value: { title: 'Fourth', currentRevision: 4 } });
  expect(await adapter.readCurrent(otherId)).toEqual(beforeOther);
  // Separate reads can span a commit; only an explicitly pinned history view stays stable.
  const oldCurrent = await adapter.readCurrent(mapId);
  const next = prepareApply(await current(adapter), request({ title: 'Fifth' }, 4));
  if (next.kind !== 'prepared') throw new Error('Expected preparation');
  await adapter.commit(next.change);
  expect(oldCurrent).toMatchObject({ kind: 'found', value: { currentRevision: 4 } });
  expect(await adapter.readRevision(mapId, 5)).toMatchObject({ kind: 'found', value: { revision: 5 } });
  expect(await adapter.readRevision(mapId, 1)).toEqual(first);
  expect(await adapter.readRevision(mapId, 6)).toMatchObject({ kind: 'not_found', code: 'revision_not_found' });
  const beforeFailures = await observe(adapter, 5);
  expect(prepareApply(await current(adapter), request({ title: 'Fifth' }, 5))).toEqual({ kind: 'rejected', rejection: { stage: 'final_state', code: 'no_changes' } });
  expect(await observe(adapter, 5)).toEqual(beforeFailures);
  expect(prepareApply(await current(adapter), request({}, 5))).toMatchObject({ kind: 'rejected', rejection: { stage: 'input', error: { code: 'invalid_input', path: ['commands', 0, 'patch'] } } });
  expect(await observe(adapter, 5)).toEqual(beforeFailures);
  expect(await adapter.commit(next.change)).toEqual({ kind: 'conflict', conflict: { mapId: 'Alpha', expectedRevision: 4, currentRevision: 5 } });
  expect(await observe(adapter, 5)).toEqual(beforeFailures);
});

test('S05: distinct Map applies against independent heads can both commit', async () => {
  const adapter = await setup();
  const oldAlpha = await adapter.readRevision(mapId, 1), oldOther = await adapter.readRevision(otherId, 1);
  const second = await adapter.readCurrent(otherId);
  if (second.kind !== 'found') throw new Error('Expected other Map');
  const proposals = [
    prepareApply(await current(adapter), request({ title: 'Alpha changed' })),
    prepareApply(second.value, { ...request({ title: 'Other changed' }), mapId: otherId }),
  ];
  expect(await Promise.all(proposals.map((prepared) => {
    if (prepared.kind !== 'prepared') throw new Error('Expected preparation');
    return adapter.commit(prepared.change);
  }))).toMatchObject([
    { kind: 'committed', revision: { mapId: 'Alpha', revision: 2, state: { title: 'Alpha changed' } } },
    { kind: 'committed', revision: { mapId: 'Other', revision: 2, state: { title: 'Other changed' } } },
  ]);
  expect(await adapter.readRevision(mapId, 1)).toEqual(oldAlpha);
  expect(await adapter.readRevision(otherId, 1)).toEqual(oldOther);
});

const cyclic: Record<string, unknown> = {};
cyclic.self = cyclic;
test.each([
  { value: { plain: 1 }, suffix: ['plain'] },
  { value: { 'App.bad': true }, suffix: ['App.bad'] },
  { value: { 'app.bad\n': 1 }, suffix: ['app.bad\n'] },
  { value: [], suffix: [] },
  ...[NaN, Infinity, -Infinity, undefined, () => 1, Symbol('x'), 1n, new Date(), new Map()].map((entry) => ({ value: { 'app.bad': entry }, suffix: ['app.bad'] })),
  { value: { 'app.bad': cyclic }, suffix: ['app.bad', 'self'] },
  { value: { 'app.bad': [null, { value: Infinity }] }, suffix: ['app.bad', 1, 'value'] },
])('V05: invalid Extensions branch %# rejects through raw and typed seams without publication', async ({ value, suffix }) => {
  const adapter = await setup();
  const before = await observe(adapter);
  const submitted = request({ extensions: value } as MapPatch);
  const path = ['commands', 0, 'patch', 'extensions', ...suffix];
  expect(decodeApplyRequest(submitted)).toMatchObject({ kind: 'error', error: { code: 'invalid_input', path } });
  expect(prepareApply(await current(adapter), submitted)).toMatchObject({ kind: 'rejected', rejection: { stage: 'input', error: { code: 'invalid_input', path } } });
  expect(await observe(adapter)).toEqual(before);
});

test('V06: extension replacement preserves omitted Map fields and accepts nested plain JSON', async () => {
  const adapter = await setup();
  const state = await current(adapter);
  const plain = Object.create(null) as Record<string, unknown>;
  plain.nested = { constructor: 'ordinary key', toString: 'ordinary key', values: [true, false, null, 4, 'text'] };
  const submitted = request({ extensions: { 'app.new': plain } } as MapPatch);
  const decoded = decodeApplyRequest(submitted);
  expect(decoded.kind).toBe('ok');
  const prepared = prepareApply(state, submitted);
  if (prepared.kind !== 'prepared') throw new Error('Expected preparation');
  expect(await adapter.commit(prepared.change)).toMatchObject({ kind: 'committed', revision: { state: {
    title: 'Original', destination: 'Arrive', notes: 'Keep notes', extensions: { 'app.new': plain },
  } } });
});

test.each([
  { kind: 'unexpected' }, { kind: 'create', priorRevision: null }, { priorRevision: null },
  ...[0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1].map((priorRevision) => ({ priorRevision })),
  { mapId: ' bad' }, { mapId: 'Other' },
  { head: 1 }, { head: 3 }, { head: Number.MAX_SAFE_INTEGER + 1 }, { head: NaN },
])('S11: malformed apply envelope branch %# rejects its Promise without any publication', async (patch) => {
  const adapter = await setup();
  const prepared = prepareApply(await current(adapter), request());
  if (prepared.kind !== 'prepared') throw new Error('Expected preparation');
  const before = await observe(adapter);
  const { head, ...fields } = patch as { head?: number } & Record<string, unknown>;
  const malformed = { ...prepared.change, ...fields,
    next: { ...prepared.change.next, ...('head' in patch ? { currentRevision: head } : {}) },
  } as PreparedCommit;
  await expect(adapter.commit(malformed)).rejects.toBeInstanceOf(TypeError);
  expect(await observe(adapter)).toEqual(before);
  expect(await adapter.commit(prepared.change)).toMatchObject({ kind: 'committed', revision: { revision: 2 } });
});

function attempt(change: () => void) {
  try { change(); } catch (error) { if (!(error instanceof TypeError)) throw error; }
}

test('S10/S11: mutable input and after-invocation changes cannot alter the exact captured commit', async () => {
  const adapter = await setup();
  const state = structuredClone(await current(adapter));
  const submitted = { ...request(), author: { ...author }, commands: [
    { kind: 'map.update' as const, patch: { extensions: { 'app.new': { items: [{ value: 'original' }] } } } },
  ] } satisfies ApplyRequest;
  const prepared = prepareApply(state, submitted);
  if (prepared.kind !== 'prepared') throw new Error('Expected preparation');
  Object.assign(state, { notes: 'changed original state' });
  submitted.commands[0]!.patch.extensions['app.new'].items[0]!.value = 'changed original request';
  submitted.author.occurredAt = '2025-01-01T00:00:00Z';
  const mutable = structuredClone(prepared.change) as PreparedCommit;
  const pending = adapter.commit(mutable);
  Object.assign(mutable.next, { notes: 'changed after invocation' });
  Object.assign(mutable.author, { actorId: 'changed after invocation' });
  const result = await pending;
  expect(result).toMatchObject({ kind: 'committed', revision: {
    author, state: { notes: 'Keep notes', extensions: { 'app.new': { items: [{ value: 'original' }] } } },
  } });
  const before = await observe(adapter, 2);
  const read = await adapter.readCurrent(mapId), history = await adapter.readRevision(mapId, 2);
  if (result.kind !== 'committed' || read.kind !== 'found' || history.kind !== 'found') throw new Error('Expected commit/read');
  for (const value of [prepared.change.next, result.revision.state, read.value, history.value.state]) {
    attempt(() => Object.assign(value, { title: 'changed', currentRevision: 99 }));
    expect(await observe(adapter, 2)).toEqual(before);
    const nested = value.extensions['app.new'] as { items: { value: string }[] };
    attempt(() => { nested.items[0]!.value = 'changed'; });
    expect(await observe(adapter, 2)).toEqual(before);
    attempt(() => nested.items.push({ value: 'changed' }));
    expect(await observe(adapter, 2)).toEqual(before);
  }
  for (const value of [prepared.change, result.revision, history.value]) {
    attempt(() => Object.assign(value.author, { clientId: 'changed' }));
    expect(await observe(adapter, 2)).toEqual(before);
    attempt(() => Object.assign(value.changes[0], { commandIndex: 99, subjectId: 'changed' }));
    expect(await observe(adapter, 2)).toEqual(before);
    attempt(() => (value.changes as unknown as unknown[]).push({}));
    expect(await observe(adapter, 2)).toEqual(before);
  }
});

test.each([0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
  'V08: invalid supplied current head %s is an input error rather than a Conflict', async (currentRevision) => {
    const adapter = await setup();
    const before = await observe(adapter);
    expect(prepareApply({ ...await current(adapter), currentRevision }, request())).toMatchObject({
      kind: 'rejected', rejection: { stage: 'input', error: { code: 'invalid_input', path: ['current', 'currentRevision'] } },
    });
    expect(await observe(adapter)).toEqual(before);
  },
);
