import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, expect, test } from 'vitest';
import { createMemoryAdapter, parseId, prepareApply, prepareCreate } from '../src/index.js';
import type { Command, MapId, PreparedCommit, StateAdapter, StoredMapState } from '../src/index.js';
import { sqliteLifecycleForTests } from '../src/sqlite-internal.js';
import { initializeSQLite, openSQLite } from '../src/sqlite-storage.js';

const directories: string[] = [];
function fixture() {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'wayfinder-sqlite-')));
  directories.push(directory);
  return join(directory, 'private', 'maps.sqlite');
}
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true }); });
function id(value: string) {
  const result = parseId('Map', value);
  if (result.kind !== 'ok') throw new Error('Invalid fixture');
  return result.value;
}
const author = { actorId: parseId('Actor', 'kun'), clientId: parseId('Client', 'codex') };
function creation(mapId = 'Alpha') {
  if (author.actorId.kind !== 'ok' || author.clientId.kind !== 'ok') throw new Error('Invalid fixture');
  const result = prepareCreate({ id: id(mapId), title: `${mapId} route`, destination: 'Usable core',
    author: { actorId: author.actorId.value, clientId: author.clientId.value, occurredAt: '2026-09-18T03:00:00Z' } });
  if (result.kind !== 'ok') throw new Error('Invalid fixture');
  return result.value;
}
function application(current: StoredMapState, commands: [Command, ...Command[]]) {
  const result = prepareApply(current, { mapId: current.id, expectedRevision: current.currentRevision,
    author: creation().author, commands });
  if (result.kind !== 'prepared') throw new Error(JSON.stringify(result));
  return result.change;
}
async function observe(adapter: StateAdapter) {
  return Promise.all(['Alpha', 'Other'].map(async value => ({ current: await adapter.readCurrent(id(value)),
    revisions: await Promise.all([1, 2, 3].map(revision => adapter.readRevision(id(value), revision))) })));
}

test('D01: explicit fresh initialization opens an empty durable Adapter', async () => {
  const path = fixture();
  const lifecycle = sqliteLifecycleForTests();
  lifecycle.initialize(path);
  const storage = lifecycle.open(path);
  try {
    expect(await storage.adapter.readCurrent(id('Alpha'))).toEqual({ kind: 'not_found', code: 'map_not_found', mapId: 'Alpha' });
  } finally { storage.close(); }
});

test('D03: complete Revision 1 survives close and reopening', async () => {
  const path = fixture();
  const lifecycle = sqliteLifecycleForTests();
  lifecycle.initialize(path);
  const storage = lifecycle.open(path);
  const prepared = creation();
  try {
    expect(await storage.adapter.commit(prepared)).toEqual({ kind: 'committed', frontier: [], revision: {
      mapId: 'Alpha', revision: 1, priorRevision: null, kind: 'create', author: prepared.author,
      changes: [{ commandIndex: 0, command: 'map.create', subjectId: 'Alpha' }],
      state: { id: 'Alpha', title: 'Alpha route', destination: 'Usable core', notes: '',
        fog: [], scopeExclusions: [], tickets: [], extensions: {}, currentRevision: 1 },
    } });
  } finally { storage.close(); }
  const reopened = lifecycle.open(path);
  try {
    expect(await reopened.adapter.readRevision(id('Alpha'), 1)).toEqual({ kind: 'found', value: {
      mapId: 'Alpha', revision: 1, priorRevision: null, kind: 'create', author: prepared.author,
      changes: [{ commandIndex: 0, command: 'map.create', subjectId: 'Alpha' }], state: prepared.next,
    } });
    expect(await reopened.adapter.readCurrent(id('Alpha'))).toEqual({ kind: 'found', value: prepared.next });
  } finally { reopened.close(); }
});

test.each(['missing', 'empty', 'foreign', 'unsupported'] as const)('D01: normal opening refuses %s without replacing it', (kind) => {
  const path = fixture();
  const lifecycle = sqliteLifecycleForTests();
  mkdirSync(dirname(path), { mode: 0o700 });
  if (kind === 'empty') writeFileSync(path, '', { mode: 0o600 });
  if (kind === 'foreign' || kind === 'unsupported') {
    lifecycle.initialize(path);
    const db = new DatabaseSync(path);
    db.exec(kind === 'foreign' ? 'PRAGMA application_id=123' : 'PRAGMA user_version=99');
    db.close();
  }
  const before = existsSync(path) ? readFileSync(path) : null;
  expect(() => lifecycle.open(path)).toThrow();
  expect(existsSync(path) ? readFileSync(path) : null).toEqual(before);
});

test.each(['empty', 'nonempty'] as const)('D01: initialization refuses an existing %s file unchanged', (kind) => {
  const path = fixture();
  mkdirSync(dirname(path), { mode: 0o700 });
  writeFileSync(path, kind === 'empty' ? '' : 'user data', { mode: 0o600 });
  const before = readFileSync(path);
  expect(() => sqliteLifecycleForTests().initialize(path)).toThrow();
  expect(readFileSync(path)).toEqual(before);
});

test('D02: new directory/database are private and production paths reject temporary/relative storage', () => {
  const path = fixture();
  const lifecycle = sqliteLifecycleForTests();
  lifecycle.initialize(path);
  expect(lstatSync(dirname(path)).mode & 0o777).toBe(0o700);
  expect(lstatSync(path).mode & 0o777).toBe(0o600);
  expect(() => initializeSQLite('relative.sqlite')).toThrow();
  expect(() => openSQLite(path)).toThrow();
  const missing = join(dirname(path), 'must-not-create.sqlite');
  expect(() => initializeSQLite(missing)).toThrow();
  expect(existsSync(missing)).toBe(false);
});

test.each(['directory', 'database', 'symlink-file', 'symlink-directory'] as const)('D02: reject unsafe %s without fixing it', (kind) => {
  const path = fixture();
  const lifecycle = sqliteLifecycleForTests();
  lifecycle.initialize(path);
  let attempted = path;
  if (kind === 'directory') chmodSync(dirname(path), 0o755);
  if (kind === 'database') chmodSync(path, 0o644);
  if (kind === 'symlink-file') { attempted = join(dirname(path), 'alias.sqlite'); symlinkSync(path, attempted); }
  if (kind === 'symlink-directory') { const alias = join(dirname(dirname(path)), 'alias'); symlinkSync(dirname(path), alias); attempted = join(alias, 'maps.sqlite'); }
  const before = readFileSync(path);
  expect(() => lifecycle.open(attempted)).toThrow();
  expect(readFileSync(path)).toEqual(before);
  expect(lstatSync(kind === 'directory' ? dirname(path) : path).mode & 0o777).toBe(kind === 'directory' ? 0o755 : kind === 'database' ? 0o644 : 0o600);
});

test('D02: WAL sidecars are private managed state while the connection is open', () => {
  const path = fixture();
  const lifecycle = sqliteLifecycleForTests();
  lifecycle.initialize(path);
  const storage = lifecycle.open(path);
  const observer = new DatabaseSync(path);
  try {
    expect(observer.prepare('PRAGMA journal_mode').get()?.journal_mode).toBe('wal');
    for (const suffix of ['-wal', '-shm']) {
      expect(lstatSync(path + suffix).mode & 0o777).toBe(0o600);
    }
  } finally { observer.close(); storage.close(); }
});

test('D04: two real connections serialize same-head and duplicate-create competition without collateral publication', async () => {
  const path = fixture(); const lifecycle = sqliteLifecycleForTests(); lifecycle.initialize(path);
  const first = lifecycle.open(path); const second = lifecycle.open(path);
  try {
    const initial = creation();
    await first.adapter.commit(initial);
    await first.adapter.commit(creation('Other'));
    const winner = application(initial.next, [{ kind: 'map.update', patch: { notes: 'winner' } }]);
    const loser = application(initial.next, [{ kind: 'map.update', patch: { notes: 'loser' } }]);
    expect(await first.adapter.commit(winner)).toMatchObject({ kind: 'committed', revision: { revision: 2, state: { notes: 'winner' } } });
    const before = await observe(first.adapter);
    expect(await second.adapter.commit(loser)).toEqual({ kind: 'conflict', conflict: { mapId: 'Alpha', expectedRevision: 1, currentRevision: 2 } });
    expect(await observe(second.adapter)).toEqual(before);
    expect(await second.adapter.commit(initial)).toEqual({ kind: 'rejected', code: 'map_already_exists', mapId: 'Alpha' });
    expect(await observe(first.adapter)).toEqual(before);
    const other = creation('Other');
    expect(await second.adapter.commit(application(other.next, [{ kind: 'map.update', patch: { notes: 'independent' } }]))).toMatchObject({ kind: 'committed', revision: { mapId: 'Other', revision: 2 } });
    expect(await first.adapter.readRevision(id('Alpha'), 1)).toMatchObject({ kind: 'found', value: { state: { notes: '' } } });
  } finally { first.close(); second.close(); }
});

test.each([0, -1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1])('D05: invalid read revision %s does not publish', async revision => {
  const path = fixture(); const lifecycle = sqliteLifecycleForTests(); lifecycle.initialize(path); const storage = lifecycle.open(path);
  try {
    await storage.adapter.commit(creation()); await storage.adapter.commit(creation('Other'));
    const before = await observe(storage.adapter);
    expect(await storage.adapter.readRevision(id('Alpha'), revision)).toMatchObject({ kind: 'rejected', error: { path: ['revision'] } });
    expect(await storage.adapter.readCurrent(' bad' as MapId)).toMatchObject({ kind: 'rejected', error: { path: ['mapId'] } });
    expect(await observe(storage.adapter)).toEqual(before);
  } finally { storage.close(); }
});

test.each([{ mapId: 'Other' }, { priorRevision: 1 }, { next: { id: 'Alpha', currentRevision: 2 } }, { kind: 'import' }])('D08: malformed prepared envelope %j never publishes', async patch => {
  const path = fixture(); const lifecycle = sqliteLifecycleForTests(); lifecycle.initialize(path); const storage = lifecycle.open(path);
  try {
    await storage.adapter.commit(creation()); await storage.adapter.commit(creation('Other'));
    const before = await observe(storage.adapter);
    await expect(storage.adapter.commit({ ...creation(), ...patch } as unknown as PreparedCommit)).rejects.toThrow(TypeError);
    expect(await observe(storage.adapter)).toEqual(before);
  } finally { storage.close(); }
});

test('D09: catalog pages have coherent head fields and ASCII lexical boundaries, including nonexistent cursor IDs', async () => {
  const path = fixture(); const lifecycle = sqliteLifecycleForTests(); lifecycle.initialize(path); const storage = lifecycle.open(path);
  try {
    for (const mapId of ['alpha', 'Zed', 'Alpha']) await storage.adapter.commit(creation(mapId));
    const changed = application(creation().next, [{ kind: 'map.update', patch: { title: 'Changed', destination: 'New goal' } }]);
    await storage.adapter.commit(changed);
    const before = await observe(storage.adapter);
    expect(storage.listMaps({ limit: 2 })).toEqual({ kind: 'listed', maps: [
      { mapId: 'Alpha', title: 'Changed', destination: 'New goal', currentRevision: 2 },
      { mapId: 'Zed', title: 'Zed route', destination: 'Usable core', currentRevision: 1 },
    ], nextAfterMapId: 'Zed' });
    expect(storage.listMaps({ afterMapId: id('Beta') })).toEqual({ kind: 'listed', maps: [
      { mapId: 'Zed', title: 'Zed route', destination: 'Usable core', currentRevision: 1 },
      { mapId: 'alpha', title: 'alpha route', destination: 'Usable core', currentRevision: 1 },
    ], nextAfterMapId: null });
    expect(storage.listMaps({ afterMapId: id('zz') })).toEqual({ kind: 'listed', maps: [], nextAfterMapId: null });
    expect(await observe(storage.adapter)).toEqual(before);
  } finally { storage.close(); }
});

test('D06: failure after transaction writes but before publication rolls back both head/history and permits the next commit', async () => {
  const path = fixture(); let fail = false;
  const lifecycle = sqliteLifecycleForTests(() => { if (fail) throw new Error('Injected pre-publication failure'); });
  lifecycle.initialize(path); const storage = lifecycle.open(path);
  try {
    await storage.adapter.commit(creation()); await storage.adapter.commit(creation('Other'));
    const before = await observe(storage.adapter); const catalog = storage.listMaps();
    const changed = application(creation().next, [{ kind: 'map.update', patch: { title: 'Rolled back' } }]);
    fail = true;
    await expect(storage.adapter.commit(changed)).rejects.toThrow('Injected');
    expect(await observe(storage.adapter)).toEqual(before); expect(storage.listMaps()).toEqual(catalog);
    fail = false;
    expect(await storage.adapter.commit(changed)).toMatchObject({ kind: 'committed', revision: { revision: 2 } });
  } finally { storage.close(); }
});

function handle<K extends string>(kind: K, value: string) {
  const parsed = parseId(kind, value);
  if (parsed.kind !== 'ok') throw new Error('Invalid fixture ID');
  return parsed.value;
}
async function current(adapter: StateAdapter) {
  const result = await adapter.readCurrent(id('Alpha'));
  if (result.kind !== 'found') throw new Error('Expected state');
  return result.value;
}
async function advance(adapter: StateAdapter, commands: [Command, ...Command[]]) {
  const result = await adapter.commit(application(await current(adapter), commands));
  if (result.kind !== 'committed') throw new Error('Expected commit');
  return result;
}
function conformanceAdapter(kind: 'memory' | 'sqlite') {
  if (kind === 'memory') return { adapter: createMemoryAdapter(), close() {} };
  const path = fixture(); const lifecycle = sqliteLifecycleForTests(); lifecycle.initialize(path); return lifecycle.open(path);
}
const commonSettlement = {
  evidence: [{ statement: 'Checked', references: [{ locator: 'opaque:source' }], extensions: { 'demo.evidence': [null, true] } }],
  references: [{ locator: 'artifact:result', label: 'Result' }], provenance: { method: 'inspection', sources: [{ locator: 'session:work' }] },
  extensions: { 'demo.result': { nested: [3, '♥', false] } },
};
const settlementCases = [
  { ticketType: 'grilling' as const, settlement: { ...commonSettlement, outcome: { kind: 'decision' as const, statement: 'Choose', rationale: 'Reviewed' } } },
  { ticketType: 'prototype' as const, settlement: { ...commonSettlement, outcome: { kind: 'decision' as const, statement: 'Choose', rationale: 'Reviewed' } } },
  { ticketType: 'research' as const, settlement: { ...commonSettlement, outcome: { kind: 'finding' as const, statement: 'Limited result', limitations: 'Local only' } } },
  { ticketType: 'task' as const, settlement: { ...commonSettlement, outcome: { kind: 'completion' as const, statement: 'Done', resultingFacts: { nested: [null, true, '♥'] } } } },
];

test.each(['memory', 'sqlite'] as const)('D03/D08/D09 reusable %s conformance: all typed Settlements, Claims, introduction metadata, pinned history and detachment', async kind => {
  const storage = conformanceAdapter(kind); const adapter = storage.adapter;
  const claimantId = handle('Claimant', 'work:Alpha');
  try {
    await adapter.commit(creation()); await adapter.commit(creation('Other'));
    for (const fixture of settlementCases) {
      const ticketId = handle('Ticket', fixture.ticketType);
      await advance(adapter, [{ kind: 'ticket.create', ticket: { id: ticketId, title: fixture.ticketType, question: 'Ready?', type: fixture.ticketType } },
        { kind: 'claim.acquire', ticketId, claimantId }]);
      const pinned = await current(adapter); const historicalClaim = await adapter.readRevision(id('Alpha'), pinned.currentRevision);
      expect(pinned.tickets.at(-1)).toMatchObject({ claim: 'work:Alpha', status: 'open' });
      const command = { kind: 'ticket.settle', ticketId, claimantId, ...fixture } as Command;
      const settled = await advance(adapter, [command]);
      expect(settled.frontier).toEqual(settlementCases.slice(0, settlementCases.indexOf(fixture)).map(value => value.ticketType).sort());
      expect(settled.revision.state.tickets.at(-1)).toMatchObject({ status: 'settled', claim: null,
        settlement: { ...fixture.settlement, introducedAtRevision: settled.revision.revision } });
      expect(await adapter.readRevision(id('Alpha'), settled.revision.revision)).toEqual({ kind: 'found', value: settled.revision });
      const later = await advance(adapter, [{ kind: 'map.update', patch: { notes: fixture.ticketType } }]);
      expect(later.revision.state.tickets.at(-1)).toEqual(settled.revision.state.tickets.at(-1));
      expect(await adapter.readRevision(id('Alpha'), pinned.currentRevision)).toEqual(historicalClaim);
      expect(pinned.tickets.at(-1)).toMatchObject({ status: 'open', claim: 'work:Alpha' });
      expect(() => { (settled.revision.state as { notes: string }).notes = 'corrupt'; }).toThrow();
      await advance(adapter, [{ kind: 'ticket.reopen', ticketId, reason: 'Explicit reconsideration' }]);
      expect(await adapter.readRevision(id('Alpha'), settled.revision.revision)).toEqual({ kind: 'found', value: settled.revision });
    }
    const mutable = structuredClone(application(await current(adapter), [{ kind: 'map.update', patch: { notes: 'Captured' } }])) as PreparedCommit;
    const pending = adapter.commit(mutable);
    (mutable.next as { notes: string }).notes = 'Mutated after invocation';
    const receipt = await pending;
    expect(receipt).toMatchObject({ kind: 'committed', revision: { state: { notes: 'Captured' } } });
    expect(await adapter.readCurrent(id('Other'))).toEqual({ kind: 'found', value: creation('Other').next });
  } finally { storage.close(); }
});

const negativeCommands: { label: string; commands: [Command, ...Command[]]; expected: object }[] = [
  { label: 'no-op', commands: [{ kind: 'map.update', patch: { notes: '' } }], expected: { stage: 'final_state', code: 'no_changes' } },
  { label: 'malformed', commands: [{ kind: 'map.update', patch: {} }], expected: { stage: 'input', error: { code: 'invalid_input' } } },
  { label: 'missing ticket', commands: [{ kind: 'ticket.update', ticketId: handle('Ticket', 'Missing'), patch: { title: 'X' } }], expected: { stage: 'command', commandIndex: 0, code: 'ticket_not_found' } },
  { label: 'claim mismatch', commands: [{ kind: 'claim.release', ticketId: handle('Ticket', 'A'), claimantId: handle('Claimant', 'Wrong') }], expected: { stage: 'command', commandIndex: 0, code: 'claim_mismatch' } },
  { label: 'lifecycle', commands: [{ kind: 'ticket.reopen', ticketId: handle('Ticket', 'B'), reason: 'Already open' }], expected: { stage: 'command', commandIndex: 0, code: 'ticket_not_settled' } },
  { label: 'self dependency', commands: [{ kind: 'dependency.add', dependentId: handle('Ticket', 'B'), prerequisiteId: handle('Ticket', 'B') }], expected: { stage: 'command', commandIndex: 0, code: 'self_dependency' } },
  { label: 'final claimed invariant', commands: [{ kind: 'dependency.add', dependentId: handle('Ticket', 'A'), prerequisiteId: handle('Ticket', 'B'), claimantId: handle('Claimant', 'work') }], expected: { stage: 'final_state', code: 'claimed_ticket_has_open_prerequisite' } },
  { label: 'cycle', commands: [{ kind: 'dependency.add', dependentId: handle('Ticket', 'B'), prerequisiteId: handle('Ticket', 'C') }, { kind: 'dependency.add', dependentId: handle('Ticket', 'C'), prerequisiteId: handle('Ticket', 'B') }], expected: { stage: 'final_state', code: 'dependency_cycle' } },
];
test.each(['memory', 'sqlite'] as const)('D05 reusable %s conformance: whole-shape, Claim, lifecycle, dependency, invariant and no-op rejections publish nothing', async kind => {
  const storage = conformanceAdapter(kind); const adapter = storage.adapter;
  try {
    await adapter.commit(creation()); await adapter.commit(creation('Other'));
    await advance(adapter, [
      { kind: 'ticket.create', ticket: { id: handle('Ticket', 'A'), title: 'A', question: 'Ready?', type: 'task' } },
      ...['B', 'C'].map(value => ({ kind: 'ticket.create' as const, ticket: { id: handle('Ticket', value), title: value, question: 'Ready?', type: 'task' as const } })),
      { kind: 'claim.acquire', ticketId: handle('Ticket', 'A'), claimantId: handle('Claimant', 'work') },
    ]);
    const before = await observe(adapter); const state = await current(adapter);
    for (const scenario of negativeCommands) {
      expect(prepareApply(state, { mapId: state.id, expectedRevision: state.currentRevision, author: creation().author, commands: scenario.commands }), scenario.label)
        .toMatchObject({ kind: 'rejected', rejection: scenario.expected });
      expect(await observe(adapter), scenario.label).toEqual(before);
    }
    const missing = application({ ...state, id: id('Missing') }, [{ kind: 'map.update', patch: { notes: 'No Map' } }]);
    expect(await adapter.commit(missing)).toEqual({ kind: 'rejected', code: 'map_not_found', mapId: 'Missing' });
    expect(await adapter.readCurrent(id('Missing'))).toEqual({ kind: 'not_found', code: 'map_not_found', mapId: 'Missing' });
    expect(await observe(adapter)).toEqual(before);
  } finally { storage.close(); }
});

test.each([0, 101, 1.5, NaN, null])('D09: invalid catalog limit %s is rejected without changes', async limit => {
  const path = fixture(); const lifecycle = sqliteLifecycleForTests(); lifecycle.initialize(path); const storage = lifecycle.open(path);
  try {
    await storage.adapter.commit(creation()); await storage.adapter.commit(creation('Other')); const before = await observe(storage.adapter);
    expect(storage.listMaps({ limit: limit as number })).toMatchObject({ kind: 'rejected', error: { path: ['limit'] } });
    expect(await observe(storage.adapter)).toEqual(before);
  } finally { storage.close(); }
});

test.each(['unsafe', 'dangling-symlink'] as const)('D02: reject %s managed sidecar before opening or modifying the database', kind => {
  const path = fixture(); const lifecycle = sqliteLifecycleForTests(); lifecycle.initialize(path);
  if (kind === 'unsafe') writeFileSync(path + '-wal', '', { mode: 0o644 });
  else symlinkSync(join(dirname(path), 'absent'), path + '-wal');
  const before = readFileSync(path);
  expect(() => lifecycle.open(path)).toThrow();
  expect(readFileSync(path)).toEqual(before);
});

test('D01: unsupported schema is refused as format recognition, without scanning stored history', () => {
  const path = fixture(); const lifecycle = sqliteLifecycleForTests(); lifecycle.initialize(path);
  const injector = new DatabaseSync(path); injector.exec('DROP TABLE revisions'); injector.close();
  const before = readFileSync(path);
  expect(() => lifecycle.open(path)).toThrow();
  expect(readFileSync(path)).toEqual(before);
});

test('D03/D09: reopening preserves logical Claims and full Settlement history; malformed JSON fails only when read, without proactive audit', async () => {
  const path = fixture(); const lifecycle = sqliteLifecycleForTests(); lifecycle.initialize(path); const storage = lifecycle.open(path);
  const ticketId = handle('Ticket', 'Research'); const claimantId = handle('Claimant', 'continued:work');
  let claimed;
  try {
    await storage.adapter.commit(creation());
    claimed = await advance(storage.adapter, [{ kind: 'ticket.create', ticket: { id: ticketId, title: 'Research', question: 'What is known?', type: 'research' } },
      { kind: 'claim.acquire', ticketId, claimantId }]);
    await advance(storage.adapter, [{ kind: 'ticket.settle', ticketId, ticketType: 'research', claimantId,
      settlement: { ...commonSettlement, outcome: { kind: 'finding', statement: 'Known', limitations: 'This slice' } } }]);
  } finally { storage.close(); }
  const reopened = lifecycle.open(path);
  try {
    expect(await reopened.adapter.readRevision(id('Alpha'), 2)).toEqual({ kind: 'found', value: claimed.revision });
    expect(await reopened.adapter.readCurrent(id('Alpha'))).toMatchObject({ kind: 'found', value: { currentRevision: 3,
      tickets: [{ status: 'settled', claim: null, settlement: { introducedAtRevision: 3, outcome: { kind: 'finding', limitations: 'This slice' } } }] } });
  } finally { reopened.close(); }
  // Fault injection at the real SQL boundary, not assertions about private business rows.
  const injector = new DatabaseSync(path); injector.prepare('UPDATE revisions SET record=? WHERE map_id=? AND revision=?').run('{broken', 'Alpha', 1); injector.close();
  const noAudit = lifecycle.open(path);
  try {
    expect(await noAudit.adapter.readCurrent(id('Alpha'))).toMatchObject({ kind: 'found', value: { currentRevision: 3 } });
    await expect(noAudit.adapter.readRevision(id('Alpha'), 1)).rejects.toThrow(SyntaxError);
  } finally { noAudit.close(); }
});
