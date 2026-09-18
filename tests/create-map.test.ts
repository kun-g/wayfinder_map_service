import { expect, test } from 'vitest';
import { createMemoryAdapter, parseId, prepareCreate } from '../src/index.js';
import type { CreateMapInput, MapId, PreparedCommit, StateAdapter } from '../src/index.js';

function id<K extends string>(kind: K, value: string) {
  const result = parseId(kind, value);
  if (result.kind !== 'ok') throw new Error('Invalid test ID');
  return result.value;
}

const input = {
  id: id('Map', 'Alpha'), title: 'Alpha route', destination: 'A usable Map core',
  author: {
    actorId: id('Actor', 'kun'), clientId: id('Client', 'codex'),
    occurredAt: '2026-09-18T03:00:00Z',
  },
};

async function create(adapter: StateAdapter, value: CreateMapInput = input) {
  const prepared = prepareCreate(value);
  if (prepared.kind !== 'ok') throw new Error('Expected valid fixture');
  return adapter.commit(prepared.value);
}

async function observe(adapter: StateAdapter, ids: readonly MapId[]) {
  return structuredClone(await Promise.all(ids.map(async (mapId) => ({
    current: await adapter.readCurrent(mapId),
    first: await adapter.readRevision(mapId, 1),
    proposed: await adapter.readRevision(mapId, 2),
  }))));
}

test('V01: create commits exactly Revision 1 with one Destination and empty content', async () => {
  const adapter = createMemoryAdapter();
  const prepared = prepareCreate(input);
  expect(prepared.kind).toBe('ok');
  if (prepared.kind !== 'ok') throw new Error('Expected preparation');
  const result = await adapter.commit(prepared.value);
  const state = {
    id: 'Alpha', title: 'Alpha route', destination: 'A usable Map core', notes: '',
    fog: [], scopeExclusions: [], tickets: [], extensions: {}, currentRevision: 1,
  };
  const revision = {
    mapId: 'Alpha', revision: 1, priorRevision: null, kind: 'create',
    author: input.author,
    changes: [{ commandIndex: 0, command: 'map.create', subjectId: 'Alpha' }], state,
  };
  expect(result).toEqual({ kind: 'committed', revision, frontier: [] });
  expect(await adapter.readCurrent(input.id)).toEqual({ kind: 'found', value: state });
  expect(await adapter.readRevision(input.id, 1)).toEqual({ kind: 'found', value: revision });
  expect(await adapter.readRevision(input.id, 0)).toMatchObject({
    kind: 'rejected', error: { code: 'invalid_input', path: ['revision'] },
  });
  expect(await adapter.readRevision(input.id, 2)).toEqual({
    kind: 'not_found', code: 'revision_not_found', mapId: 'Alpha', revision: 2,
  });
});

const invalidCreateCases: { label: string; patch: object; path: (string | number)[] }[] = [
  { label: 'missing title', patch: { title: undefined }, path: ['title'] },
  { label: 'blank title', patch: { title: ' \n\t' }, path: ['title'] },
  { label: 'non-string title', patch: { title: 1 }, path: ['title'] },
  { label: 'missing Destination', patch: { destination: undefined }, path: ['destination'] },
  { label: 'blank Destination', patch: { destination: ' \n' }, path: ['destination'] },
  { label: 'invalid MapId', patch: { id: ' New' }, path: ['id'] },
  { label: 'invalid notes', patch: { notes: null }, path: ['notes'] },
  { label: 'missing author', patch: { author: undefined }, path: ['author'] },
  { label: 'invalid ActorId', patch: { author: { ...input.author, actorId: 'bad id' } }, path: ['author', 'actorId'] },
  { label: 'invalid ClientId', patch: { author: { ...input.author, clientId: '' } }, path: ['author', 'clientId'] },
  { label: 'missing time', patch: { author: { ...input.author, occurredAt: undefined } }, path: ['author', 'occurredAt'] },
  { label: 'non-UTC time', patch: { author: { ...input.author, occurredAt: '2026-09-18T10:00:00+08:00' } }, path: ['author', 'occurredAt'] },
  { label: 'impossible date', patch: { author: { ...input.author, occurredAt: '2026-02-30T10:00:00Z' } }, path: ['author', 'occurredAt'] },
  { label: 'date only', patch: { author: { ...input.author, occurredAt: '2026-09-18' } }, path: ['author', 'occurredAt'] },
];

test.each(invalidCreateCases)('V02: $label rejects without creating or changing any Map', async ({ patch, path }) => {
  const adapter = createMemoryAdapter();
  const otherId = id('Map', 'Other');
  const newId = id('Map', 'New');
  await create(adapter);
  await create(adapter, { ...input, id: otherId });
  const ids = [input.id, otherId, newId];
  const before = await observe(adapter, ids);
  expect(prepareCreate({ ...input, id: newId, ...patch } as CreateMapInput)).toMatchObject({
    kind: 'error', error: { code: 'invalid_input', path },
  });
  expect(await observe(adapter, ids)).toEqual(before);
});

test('V02: nonblank text and explicitly empty notes are retained without trimming', async () => {
  const adapter = createMemoryAdapter();
  const result = await create(adapter, { ...input, title: ' Alpha ', destination: ' Arrive\n', notes: '' });
  expect(result).toMatchObject({ kind: 'committed', revision: {
    state: { title: ' Alpha ', destination: ' Arrive\n', notes: '' },
  } });
});

test.each(['Map', 'Ticket', 'Claimant', 'Content', 'Actor', 'Client'] as const)(
  'V03: %s IDs validate complete ASCII grammar without normalization', (kind) => {
    for (const value of ['A', '0', 'a'.repeat(128), 'A_z.9:-', 'Alpha', 'alpha', 'constructor', 'toString']) {
      expect(parseId(kind, value)).toEqual({ kind: 'ok', value });
    }
    for (const value of ['', 'a'.repeat(129), '_start', ':start', '.start', '-start', 'é', '你好',
      ' Alpha', 'Alpha ', 'a b', 'a/b', 'a\n', 'a\r\n', 'a\t', 1, null, undefined, {}, Symbol('id')]) {
      expect(parseId(kind, value)).toMatchObject({ kind: 'error', error: { code: 'invalid_input', path: [] } });
    }
  },
);

test('V03: valid inherited-property names and case-distinct IDs identify independent Maps', async () => {
  const adapter = createMemoryAdapter();
  for (const value of ['constructor', 'toString', 'Alpha', 'alpha']) {
    const mapId = id('Map', value);
    expect(await create(adapter, { ...input, id: mapId, title: value })).toMatchObject({
      kind: 'committed', revision: { mapId: value, revision: 1 },
    });
    expect(await adapter.readCurrent(mapId)).toMatchObject({ kind: 'found', value: { id: value, title: value } });
  }
});

test('S01: missing Maps and valid missing revisions are distinct from invalid input', async () => {
  const adapter = createMemoryAdapter();
  const missing = id('Map', 'Missing');
  expect(await adapter.readCurrent(input.id)).toEqual({ kind: 'not_found', code: 'map_not_found', mapId: 'Alpha' });
  expect(await adapter.readRevision(input.id, 1)).toEqual({ kind: 'not_found', code: 'map_not_found', mapId: 'Alpha' });
  await create(adapter);
  const before = await observe(adapter, [input.id, missing]);
  for (const revision of [2, Number.MAX_SAFE_INTEGER]) {
    expect(await adapter.readRevision(input.id, revision)).toEqual({
      kind: 'not_found', code: 'revision_not_found', mapId: 'Alpha', revision,
    });
    expect(await adapter.readRevision(missing, revision)).toEqual({ kind: 'not_found', code: 'map_not_found', mapId: 'Missing' });
    expect(await observe(adapter, [input.id, missing])).toEqual(before);
  }
});

test.each(['', ' Alpha', 'Alpha\n', 'a'.repeat(129), '中文', 1, null, undefined])(
  'S01: invalid read MapId %s rejects instead of reporting absence', async (raw) => {
    const adapter = createMemoryAdapter();
    const other = id('Map', 'Other');
    await create(adapter);
    await create(adapter, { ...input, id: other });
    const before = await observe(adapter, [input.id, other]);
    const malformed = raw as MapId;
    expect(await adapter.readCurrent(malformed)).toMatchObject({ kind: 'rejected', error: { code: 'invalid_input', path: ['mapId'] } });
    expect(await adapter.readRevision(malformed, 1)).toMatchObject({ kind: 'rejected', error: { code: 'invalid_input', path: ['mapId'] } });
    expect(await observe(adapter, [input.id, other])).toEqual(before);
  },
);

test.each([0, -1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, '1', null, undefined])(
  'S01: invalid revision %s rejects even for a missing Map', async (raw) => {
    const adapter = createMemoryAdapter();
    const other = id('Map', 'Other');
    const missing = id('Map', 'Missing');
    await create(adapter);
    await create(adapter, { ...input, id: other });
    const before = await observe(adapter, [input.id, other, missing]);
    for (const mapId of [input.id, missing]) {
      expect(await adapter.readRevision(mapId, raw as number)).toMatchObject({
        kind: 'rejected', error: { code: 'invalid_input', path: ['revision'] },
      });
      expect(await observe(adapter, [input.id, other, missing])).toEqual(before);
    }
  },
);

test('S02: duplicate create cannot overwrite current state or history in any Map', async () => {
  const adapter = createMemoryAdapter();
  const other = id('Map', 'Other');
  await create(adapter);
  await create(adapter, { ...input, id: other, title: 'Independent route' });
  const before = await observe(adapter, [input.id, other]);
  expect(await create(adapter, { ...input, title: 'Overwritten', destination: 'Another destination' })).toEqual({
    kind: 'rejected', code: 'map_already_exists', mapId: 'Alpha',
  });
  expect(await observe(adapter, [input.id, other])).toEqual(before);
});

test('S03: separate fresh instances neither share nor reload stored Maps', async () => {
  const first = createMemoryAdapter();
  const second = createMemoryAdapter();
  await create(first);
  expect(await second.readCurrent(input.id)).toEqual({ kind: 'not_found', code: 'map_not_found', mapId: 'Alpha' });
  expect(await second.readRevision(input.id, 1)).toEqual({ kind: 'not_found', code: 'map_not_found', mapId: 'Alpha' });
  const before = await observe(first, [input.id]);
  expect(await create(second, { ...input, title: 'Second instance' })).toMatchObject({
    kind: 'committed', revision: { revision: 1, state: { title: 'Second instance' } },
  });
  expect(await observe(first, [input.id])).toEqual(before);
  expect(await createMemoryAdapter().readCurrent(input.id)).toEqual({ kind: 'not_found', code: 'map_not_found', mapId: 'Alpha' });
  const wrong = id('Map', 'Wrong');
  expect(await first.readCurrent(wrong)).toEqual({ kind: 'not_found', code: 'map_not_found', mapId: 'Wrong' });
  expect(await first.readRevision(wrong, 1)).toEqual({ kind: 'not_found', code: 'map_not_found', mapId: 'Wrong' });
  expect(await observe(first, [input.id])).toEqual(before);
});

const cycle: Record<string, unknown> = {};
cycle.self = cycle;
const invalidShapeCases: { label: string; patch: object; path: (string | number)[] }[] = [
  { label: 'unknown core field', patch: { owner: 'kun' }, path: ['owner'] },
  { label: 'imported history', patch: { currentRevision: 42 }, path: ['currentRevision'] },
  { label: 'imported status', patch: { status: 'open' }, path: ['status'] },
  { label: 'imported Claim', patch: { claim: 'session' }, path: ['claim'] },
  { label: 'imported Tickets', patch: { tickets: [] }, path: ['tickets'] },
  { label: 'unknown author field', patch: { author: { ...input.author, owner: 'kun' } }, path: ['author', 'owner'] },
  { label: 'explicit undefined notes', patch: { notes: undefined }, path: ['notes'] },
  { label: 'explicit undefined extensions', patch: { extensions: undefined }, path: ['extensions'] },
  { label: 'non-object extensions', patch: { extensions: [] }, path: ['extensions'] },
  { label: 'non-namespaced key', patch: { extensions: { flag: true } }, path: ['extensions', 'flag'] },
  { label: 'uppercase namespace', patch: { extensions: { 'App.flag': true } }, path: ['extensions', 'App.flag'] },
  { label: 'empty extension name', patch: { extensions: { 'app.': true } }, path: ['extensions', 'app.'] },
  { label: 'newline in key', patch: { extensions: { 'app.flag\n': true } }, path: ['extensions', 'app.flag\n'] },
  { label: 'nonfinite JSON', patch: { extensions: { 'app.flag': { value: Infinity } } }, path: ['extensions', 'app.flag', 'value'] },
  { label: 'negative infinity JSON', patch: { extensions: { 'app.flag': -Infinity } }, path: ['extensions', 'app.flag'] },
  { label: 'NaN JSON', patch: { extensions: { 'app.flag': NaN } }, path: ['extensions', 'app.flag'] },
  { label: 'function JSON', patch: { extensions: { 'app.flag': () => 1 } }, path: ['extensions', 'app.flag'] },
  { label: 'symbol JSON', patch: { extensions: { 'app.flag': Symbol('x') } }, path: ['extensions', 'app.flag'] },
  { label: 'undefined JSON', patch: { extensions: { 'app.flag': undefined } }, path: ['extensions', 'app.flag'] },
  { label: 'bigint JSON', patch: { extensions: { 'app.flag': 1n } }, path: ['extensions', 'app.flag'] },
  { label: 'Date JSON', patch: { extensions: { 'app.flag': new Date('2026-01-01T00:00:00Z') } }, path: ['extensions', 'app.flag'] },
  { label: 'Map JSON', patch: { extensions: { 'app.flag': new Map() } }, path: ['extensions', 'app.flag'] },
  { label: 'cyclic JSON', patch: { extensions: { 'app.flag': cycle } }, path: ['extensions', 'app.flag', 'self'] },
  { label: 'invalid array value', patch: { extensions: { 'app.flag': [0, undefined] } }, path: ['extensions', 'app.flag', 1] },
  { label: 'sparse array', patch: { extensions: { 'app.flag': new Array(1) } }, path: ['extensions', 'app.flag', 0] },
];

test.each(invalidShapeCases)('creation validation: $label rejects with an input path and no publication', async ({ patch, path }) => {
  const adapter = createMemoryAdapter();
  const other = id('Map', 'Other');
  const fresh = id('Map', 'Fresh');
  await create(adapter);
  await create(adapter, { ...input, id: other });
  const ids = [input.id, other, fresh];
  const before = await observe(adapter, ids);
  expect(prepareCreate({ ...input, id: fresh, ...patch } as CreateMapInput)).toMatchObject({
    kind: 'error', error: { code: 'invalid_input', path },
  });
  expect(await observe(adapter, ids)).toEqual(before);
});

test('creation validation: nested plain JSON, shared acyclic values and namespaced Extensions round-trip', async () => {
  const adapter = createMemoryAdapter();
  const shared = { unnamespacedNestedKey: ['value', 4, null, false] };
  const extensions = { 'app.option': shared, 'app.other': shared, 'team-name.x_y.z-0': {} };
  const result = await create(adapter, { ...input, notes: 'keep notes', extensions });
  expect(result).toMatchObject({ kind: 'committed', revision: { state: { notes: 'keep notes', extensions } } });
  expect(await adapter.readCurrent(input.id)).toMatchObject({ kind: 'found', value: { extensions } });
});

function attempt(change: () => void) {
  try { change(); } catch (error) { if (!(error instanceof TypeError)) throw error; }
}

test('data ownership: original input mutation cannot change prepared, committed or historical content', async () => {
  const adapter = createMemoryAdapter();
  const original = {
    ...input, author: { ...input.author }, extensions: { 'app.payload': { items: [{ value: 'original' }] } },
  };
  const untouched = structuredClone(original);
  const prepared = prepareCreate(original);
  if (prepared.kind !== 'ok') throw new Error('Expected preparation');
  expect(original).toEqual(untouched);
  expect(await adapter.readCurrent(input.id)).toMatchObject({ kind: 'not_found', code: 'map_not_found' });
  original.title = 'changed';
  original.author.occurredAt = '2025-01-01T00:00:00Z';
  original.extensions['app.payload'].items[0]!.value = 'changed';
  const result = await adapter.commit(prepared.value);
  expect(result).toMatchObject({ kind: 'committed', revision: {
    author: input.author, state: { title: 'Alpha route', extensions: { 'app.payload': { items: [{ value: 'original' }] } } },
  } });
  const before = await observe(adapter, [input.id]);
  original.extensions['app.payload'].items.push({ value: 'after commit' });
  expect(await observe(adapter, [input.id])).toEqual(before);
});

test('data ownership: mutation attempts on prepared and returned nested values cannot alter storage', async () => {
  const adapter = createMemoryAdapter();
  const other = id('Map', 'Other');
  await create(adapter, { ...input, id: other });
  const prepared = prepareCreate({ ...input, author: { ...input.author },
    extensions: { 'app.payload': { items: [{ value: 'original' }] } },
  });
  if (prepared.kind !== 'ok') throw new Error('Expected preparation');
  const pending = adapter.commit(prepared.value);
  attempt(() => Object.assign(prepared.value.next, { title: 'changed after invocation' }));
  const result = await pending;
  if (result.kind !== 'committed') throw new Error('Expected commit');
  expect(result.revision.state.title).toBe('Alpha route');
  const ids = [input.id, other];
  const before = await observe(adapter, ids);
  const current = await adapter.readCurrent(input.id);
  const history = await adapter.readRevision(input.id, 1);
  if (current.kind !== 'found' || history.kind !== 'found') throw new Error('Expected reads');
  const states = [prepared.value.next, result.revision.state, current.value, history.value.state];
  for (const state of states) {
    attempt(() => Object.assign(state, { title: 'changed', currentRevision: 99 }));
    expect(await observe(adapter, ids)).toEqual(before);
    const nested = state.extensions['app.payload'] as { items: { value: string }[] };
    attempt(() => { nested.items[0]!.value = 'changed'; });
    expect(await observe(adapter, ids)).toEqual(before);
    attempt(() => { nested.items.push({ value: 'changed' }); });
    expect(await observe(adapter, ids)).toEqual(before);
    attempt(() => { (state.tickets as unknown[]).push({}); });
    expect(await observe(adapter, ids)).toEqual(before);
  }
  for (const record of [prepared.value, result.revision, history.value]) {
    attempt(() => Object.assign(record.author, { actorId: 'changed', occurredAt: '2020-01-01T00:00:00Z' }));
    expect(await observe(adapter, ids)).toEqual(before);
    attempt(() => Object.assign(record.changes[0], { command: 'changed', subjectId: 'changed', commandIndex: 99 }));
    expect(await observe(adapter, ids)).toEqual(before);
    attempt(() => { (record.changes as unknown as unknown[]).push({}); });
    expect(await observe(adapter, ids)).toEqual(before);
  }
});

test.each([
  { kind: 'apply' }, { priorRevision: 0 }, { priorRevision: 1 }, { mapId: ' bad' },
  { next: { ...input, currentRevision: 0 } }, { next: { ...input, currentRevision: 2 } },
  { next: { ...input, currentRevision: NaN } }, { next: { ...input, id: 'Other', currentRevision: 1 } },
  { next: null },
])('trusted malformed create envelope rejects its Promise without publication: %j', async (patch) => {
  const adapter = createMemoryAdapter();
  const other = id('Map', 'Other');
  const fresh = id('Map', 'Fresh');
  await create(adapter);
  await create(adapter, { ...input, id: other });
  const prepared = prepareCreate({ ...input, id: fresh });
  if (prepared.kind !== 'ok') throw new Error('Expected preparation');
  const before = await observe(adapter, [input.id, other, fresh]);
  const malformed = { ...prepared.value, ...patch } as unknown as PreparedCommit;
  await expect(adapter.commit(malformed)).rejects.toBeInstanceOf(TypeError);
  expect(await observe(adapter, [input.id, other, fresh])).toEqual(before);
  expect(await adapter.commit(prepared.value)).toMatchObject({ kind: 'committed', revision: { revision: 1 } });
});

test('same-ID concurrent creates have one winner; distinct IDs can both commit at 1', async () => {
  const adapter = createMemoryAdapter();
  const other = id('Map', 'Other');
  await create(adapter, { ...input, id: other });
  const otherBefore = await observe(adapter, [other]);
  const first = prepareCreate(input), second = prepareCreate({ ...input, title: 'Another candidate' });
  if (first.kind !== 'ok' || second.kind !== 'ok') throw new Error('Expected preparations');
  const results = await Promise.all([adapter.commit(first.value), adapter.commit(second.value)]);
  expect(results.map((result) => result.kind).sort()).toEqual(['committed', 'rejected']);
  const winner = results.find((result) => result.kind === 'committed');
  expect(results.find((result) => result.kind === 'rejected')).toEqual({ kind: 'rejected', code: 'map_already_exists', mapId: 'Alpha' });
  if (!winner || winner.kind !== 'committed') throw new Error('Expected winner');
  expect(await adapter.readRevision(input.id, 1)).toEqual({ kind: 'found', value: winner.revision });
  expect(await adapter.readCurrent(input.id)).toEqual({ kind: 'found', value: winner.revision.state });
  expect(await adapter.readRevision(input.id, 2)).toMatchObject({ kind: 'not_found', code: 'revision_not_found' });
  expect(await observe(adapter, [other])).toEqual(otherBefore);
  const before = await observe(adapter, [input.id, other]);
  expect(await adapter.commit(first.value)).toEqual({ kind: 'rejected', code: 'map_already_exists', mapId: 'Alpha' });
  expect(await observe(adapter, [input.id, other])).toEqual(before);
  const different = [id('Map', 'Beta'), id('Map', 'Gamma')].map((mapId) => prepareCreate({ ...input, id: mapId }));
  const commits = await Promise.all(different.map((prepared) => {
    if (prepared.kind !== 'ok') throw new Error('Expected preparation');
    return adapter.commit(prepared.value);
  }));
  expect(commits).toMatchObject([
    { kind: 'committed', revision: { mapId: 'Beta', revision: 1 }, frontier: [] },
    { kind: 'committed', revision: { mapId: 'Gamma', revision: 1 }, frontier: [] },
  ]);
  expect(await observe(adapter, [input.id, other])).toEqual(before);
});

test.each([null, undefined, [], 1, 'create', new Date()])(
  'creation validation: non-object create input %s is a structured rejection', async (raw) => {
    const adapter = createMemoryAdapter();
    await create(adapter);
    const before = await observe(adapter, [input.id]);
    expect(prepareCreate(raw as unknown as CreateMapInput)).toMatchObject({ kind: 'error', error: { code: 'invalid_input', path: [] } });
    expect(await observe(adapter, [input.id])).toEqual(before);
  },
);

test.each([
  '2024-02-29T23:59:59Z', '2000-02-29T00:00:00.123456789Z',
  '2026-09-18t03:00:00z', '2026-09-18T03:00:00+00:00', '2026-09-18T03:00:00-00:00',
  '2016-12-31T23:59:60Z',
])('caller UTC timestamp is preserved exactly: %s', async (occurredAt) => {
  const adapter = createMemoryAdapter();
  expect(await create(adapter, { ...input, author: { ...input.author, occurredAt } })).toMatchObject({
    kind: 'committed', revision: { author: { occurredAt } },
  });
});

test.each([
  '1900-02-29T00:00:00Z', '2026-00-01T00:00:00Z', '2026-13-01T00:00:00Z',
  '2026-01-00T00:00:00Z', '2026-04-31T00:00:00Z', '2026-09-18T24:00:00Z',
  '2026-09-18T10:60:00Z', '2026-09-18T10:00:61Z', '2026-09-18T10:00:60Z',
  '2026-12-31T12:59:60Z', '2026-09-18T03:00:00Z\n', '2026-09-18T03:00:00', 4,
])('invalid caller timestamp %s leaves all existing Maps and history unchanged', async (occurredAt) => {
  const adapter = createMemoryAdapter();
  const other = id('Map', 'Other');
  const fresh = id('Map', 'Fresh');
  await create(adapter);
  await create(adapter, { ...input, id: other });
  const ids = [input.id, other, fresh];
  const before = await observe(adapter, ids);
  expect(prepareCreate({ ...input, id: fresh, author: { ...input.author, occurredAt } } as CreateMapInput)).toMatchObject({
    kind: 'error', error: { code: 'invalid_input', path: ['author', 'occurredAt'] },
  });
  expect(await observe(adapter, ids)).toEqual(before);
});

test('plain data validation rejects accessor and symbol fields without evaluating accessors', async () => {
  const adapter = createMemoryAdapter();
  await create(adapter);
  const before = await observe(adapter, [input.id]);
  let evaluated = false;
  const getter = { ...input, get title() { evaluated = true; return 'Alpha'; } };
  expect(prepareCreate(getter)).toMatchObject({ kind: 'error', error: { code: 'invalid_input', path: ['title'] } });
  expect(evaluated).toBe(false);
  expect(await observe(adapter, [input.id])).toEqual(before);
  const symbol = Symbol('hidden');
  const symbolInput = { ...input, [symbol]: 'unsupported' };
  expect(prepareCreate(symbolInput)).toMatchObject({
    kind: 'error', error: { code: 'invalid_input', path: ['Symbol(hidden)'] },
  });
  expect(await observe(adapter, [input.id])).toEqual(before);
});
