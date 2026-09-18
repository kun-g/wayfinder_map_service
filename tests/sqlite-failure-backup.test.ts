import { chmodSync, existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { execFileSync, fork } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { parseId, prepareApply, prepareCreate } from '../src/index.js';
import type { Command, StateAdapter, StoredMapState } from '../src/index.js';
import { SQLiteFailure, sqliteLifecycleForTests } from '../src/sqlite-internal.js';

const directories: string[] = [];
const children: ChildProcess[] = [];
beforeAll(() => { execFileSync('npm', ['run', 'build'], { stdio: 'pipe' }); });
afterEach(() => {
  for (const child of children.splice(0)) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});
function fixture() {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'wayfinder-failure-backup-')));
  directories.push(directory);
  return join(directory, 'private', 'maps.sqlite');
}
function handle<K extends string>(kind: K, value: string) {
  const result = parseId(kind, value);
  if (result.kind !== 'ok') throw new Error('Invalid fixture');
  return result.value;
}
const alpha = handle('Map', 'Alpha');
const other = handle('Map', 'Other');
const author = { actorId: handle('Actor', 'operator'), clientId: handle('Client', 'acceptance'), occurredAt: '2026-09-18T12:00:00Z' };
function creation(mapId = alpha) {
  const result = prepareCreate({ id: mapId, title: 'Acceptance route', destination: 'Durable fixture', author });
  if (result.kind !== 'ok') throw new Error('Invalid fixture');
  return result.value;
}
function proposal(state: StoredMapState, notes = 'Next') {
  const result = prepareApply(state, { mapId: state.id, expectedRevision: state.currentRevision, author,
    commands: [{ kind: 'map.update', patch: { notes } }] });
  if (result.kind !== 'prepared') throw new Error('Invalid fixture');
  return result.change;
}
async function current(adapter: StateAdapter) {
  const result = await adapter.readCurrent(alpha);
  if (result.kind !== 'found') throw new Error('Expected fixture');
  return result.value;
}
async function seed(adapter: StateAdapter) {
  await adapter.commit(creation()); await adapter.commit(creation(other));
  const lease = handle('Ticket', 'Retained'); const settled = handle('Ticket', 'Settled');
  const claimantId = handle('Claimant', 'continued:work');
  const commands: [Command, ...Command[]] = [
    { kind: 'ticket.create', ticket: { id: lease, title: 'Retained', question: 'Continue?', type: 'task' } },
    { kind: 'ticket.create', ticket: { id: settled, title: 'Settled', question: 'Done?', type: 'task' } },
    { kind: 'claim.acquire', ticketId: lease, claimantId },
    { kind: 'claim.acquire', ticketId: settled, claimantId },
  ];
  const claimed = prepareApply(await current(adapter), { mapId: alpha, expectedRevision: 1, author, commands });
  if (claimed.kind !== 'prepared') throw new Error('Invalid fixture');
  await adapter.commit(claimed.change);
  const completion = prepareApply(await current(adapter), { mapId: alpha, expectedRevision: 2, author, commands: [
    { kind: 'ticket.settle', ticketId: settled, ticketType: 'task', claimantId, settlement: {
      outcome: { kind: 'completion', statement: 'Accepted', resultingFacts: { durable: true } },
      evidence: [], references: [{ locator: 'fixture:result' }], provenance: { method: 'acceptance', sources: [] }, extensions: {},
    } },
  ] });
  if (completion.kind !== 'prepared') throw new Error('Invalid fixture');
  await adapter.commit(completion.change);
}
async function observe(adapter: StateAdapter) {
  return Promise.all([alpha, other].map(async mapId => ({ current: await adapter.readCurrent(mapId),
    history: await Promise.all([1, 2, 3, 4, 5].map(revision => adapter.readRevision(mapId, revision))) })));
}
function expectPublishedRecovery(before: Awaited<ReturnType<typeof observe>>, recovered: Awaited<ReturnType<typeof observe>>, state: Partial<StoredMapState>) {
  expect(recovered[1]).toEqual(before[1]);
  expect(recovered[0]!.history.slice(0, 3)).toEqual(before[0]!.history.slice(0, 3));
  expect(recovered[0]!.history[3]).toMatchObject({ kind: 'found', value: { revision: 4, state } });
  expect(recovered[0]!.history[4]).toEqual(before[0]!.history[4]);
}

test('D07: real independent write lock gives bounded storage-busy, no retry/publication, then permits explicit new attempt', async () => {
  const path = fixture(); const lifecycle = sqliteLifecycleForTests(); lifecycle.initialize(path); const storage = lifecycle.open(path);
  const lock = new DatabaseSync(path);
  try {
    await seed(storage.adapter); const before = await observe(storage.adapter); const catalog = storage.listMaps();
    const change = proposal(await current(storage.adapter));
    lock.exec('BEGIN IMMEDIATE');
    const started = performance.now();
    await expect(storage.adapter.commit(change)).rejects.toMatchObject({ name: 'SQLiteFailure', code: 'storage_busy', outcome: 'not_published', requiresRestart: false });
    const elapsed = performance.now() - started;
    expect(elapsed).toBeGreaterThanOrEqual(80); expect(elapsed).toBeLessThan(1500);
    expect(await observe(storage.adapter)).toEqual(before); expect(storage.listMaps()).toEqual(catalog);
    lock.exec('ROLLBACK');
    expect(await observe(storage.adapter)).toEqual(before); // Nothing retried after release.
    expect(await storage.adapter.commit(change)).toMatchObject({ kind: 'committed', revision: { revision: 4 } });
  } finally { if (lock.isTransaction) lock.exec('ROLLBACK'); lock.close(); storage.close(); }
});

test.each(['before', 'after', 'cleanup'] as const)('D06/D11/D12: %s fault reports honest outcome and restores or stops the connection', async mode => {
  const path = fixture(); let failing = false;
  const lifecycle = sqliteLifecycleForTests({
    beforePublication() { if (failing && mode !== 'after') throw new Error('private-path/SQL/credential fixture'); },
    afterPublication() { if (failing && mode === 'after') throw new Error('Lost completion'); },
    beforeRollback() { if (failing && mode === 'cleanup') throw new Error('Cleanup failed'); },
  });
  lifecycle.initialize(path); const storage = lifecycle.open(path);
  try {
    await seed(storage.adapter); const before = await observe(storage.adapter); const catalog = storage.listMaps();
    const change = proposal(await current(storage.adapter)); failing = true;
    let failure: unknown;
    try { await storage.adapter.commit(change); } catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(SQLiteFailure);
    expect(failure).toMatchObject({ outcome: mode === 'after' ? 'unknown' : 'not_published', requiresRestart: mode !== 'before', code: 'storage_failure' });
    expect((failure as Error).message).toBe('SQLite operation failed');
    if (mode === 'before') {
      expect(await observe(storage.adapter)).toEqual(before); expect(storage.listMaps()).toEqual(catalog);
      failing = false;
      expect(await storage.adapter.commit(change)).toMatchObject({ kind: 'committed', revision: { revision: 4 } });
    } else {
      await expect(storage.adapter.readCurrent(alpha)).rejects.toThrow('unusable');
      await expect(storage.adapter.readRevision(alpha, 1)).rejects.toThrow('unusable');
      await expect(storage.adapter.commit(change)).rejects.toThrow('unusable');
      expect(() => storage.listMaps()).toThrow('unusable');
      expect(() => storage.backup(join(dirname(path), 'blocked.sqlite'))).toThrow('unusable');
      expect(existsSync(join(dirname(path), 'blocked.sqlite'))).toBe(false);
      const reopened = sqliteLifecycleForTests().open(path);
      try {
        if (mode === 'cleanup') { expect(await observe(reopened.adapter)).toEqual(before); expect(reopened.listMaps()).toEqual(catalog); }
        else {
          expect(await current(reopened.adapter)).toEqual(change.next);
          expectPublishedRecovery(before, await observe(reopened.adapter), change.next);
        }
      } finally { reopened.close(); }
    }
  } finally { storage.close(); }
});

function startHost(path: string, mode: string) {
  const child = fork(fileURLToPath(new URL('./helpers/sqlite-host.mjs', import.meta.url)), [path, mode], { execArgv: [], stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  children.push(child);
  const exit = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once('error', reject); child.once('exit', (code, signal) => resolve({ code, signal }));
  });
  const messages: unknown[] = [];
  const boundary = new Promise<unknown>((resolve, reject) => {
    child.on('message', message => { messages.push(message); resolve(message); });
    child.once('error', reject); child.once('exit', () => { if (!messages.length) reject(new Error('Host exited before boundary')); });
  });
  return { child, exit, boundary, messages };
}
test.each(['graceful', 'idle', 'before', 'after'] as const)('D10/D11: controlled Adapter host %s preserves atomic durable history and Claims', async mode => {
  const path = fixture(); const lifecycle = sqliteLifecycleForTests(); lifecycle.initialize(path); const storage = lifecycle.open(path);
  await seed(storage.adapter); const before = await observe(storage.adapter); const catalog = storage.listMaps(); storage.close();
  const host = startHost(path, mode);
  expect(await host.boundary).toMatchObject(mode === 'before' || mode === 'after' ? { kind: 'boundary', boundary: mode } : { kind: 'ready', current: before[0]!.current });
  if (mode === 'graceful') host.child.send('close'); else host.child.kill('SIGKILL');
  expect(await host.exit).toEqual(mode === 'graceful' ? { code: 0, signal: null } : { code: null, signal: 'SIGKILL' });
  expect(host.messages.some(message => (message as { kind: string }).kind === 'receipt')).toBe(false);
  const restarted = lifecycle.open(path);
  try {
    if (mode !== 'after') { expect(await observe(restarted.adapter)).toEqual(before); expect(restarted.listMaps()).toEqual(catalog); }
    else {
      expectPublishedRecovery(before, await observe(restarted.adapter), { notes: 'host commit' });
    }
    const state = await current(restarted.adapter);
    expect(state.tickets[0]).toMatchObject({ claim: 'continued:work', status: 'open' });
    expect(state.tickets[1]).toMatchObject({ status: 'settled', settlement: { introducedAtRevision: 3 } });
  } finally { restarted.close(); }
  // A genuinely new host/connection observes the same recovered authority.
  const next = startHost(path, 'idle'); const ready = await next.boundary;
  expect(ready).toMatchObject({ kind: 'ready', current: { kind: 'found', value: { currentRevision: mode === 'after' ? 4 : 3 } } });
  next.child.send('close'); expect(await next.exit).toEqual({ code: 0, signal: null });
});

test('D13: consistent live WAL backup independently opens with full known history, metadata and Claims; source unchanged', async () => {
  const path = fixture(); const lifecycle = sqliteLifecycleForTests(); lifecycle.initialize(path); const source = lifecycle.open(path);
  const destination = join(dirname(dirname(path)), 'backup', 'snapshot?#%.sqlite');
  try {
    await seed(source.adapter); const before = await observe(source.adapter); const catalog = source.listMaps();
    expect(existsSync(path + '-wal')).toBe(true);
    source.backup(destination);
    expect(lstatSync(dirname(destination)).mode & 0o777).toBe(0o700);
    expect(lstatSync(destination).mode & 0o777).toBe(0o600);
    const backup = lifecycle.open(destination);
    try { expect(await observe(backup.adapter)).toEqual(before); expect(backup.listMaps()).toEqual(catalog); }
    finally { backup.close(); }
    expect(await observe(source.adapter)).toEqual(before); expect(source.listMaps()).toEqual(catalog);
    await source.adapter.commit(proposal(await current(source.adapter)));
    const independent = lifecycle.open(destination);
    try { expect(await observe(independent.adapter)).toEqual(before); }
    finally { independent.close(); }
  } finally { source.close(); }
});

test.each(['active', 'active-sidecar', 'hardlink', 'empty', 'nonempty', 'symlink', 'dangling-symlink', 'unsafe-directory', 'sidecar', 'relative'] as const)('D13: backup rejects %s destination without changing known state or existing target', async kind => {
  const path = fixture(); const lifecycle = sqliteLifecycleForTests(); lifecycle.initialize(path); const source = lifecycle.open(path);
  let destination = join(dirname(path), 'refused.sqlite');
  try {
    await seed(source.adapter); const before = await observe(source.adapter); const catalog = source.listMaps();
    if (kind === 'active') destination = path;
    if (kind === 'active-sidecar') destination = path + '-journal';
    if (kind === 'hardlink') linkSync(path, destination);
    if (kind === 'empty' || kind === 'nonempty') writeFileSync(destination, kind === 'empty' ? '' : 'Keep older backup', { mode: 0o600 });
    if (kind === 'symlink') symlinkSync(path, destination);
    if (kind === 'dangling-symlink') symlinkSync(join(dirname(path), 'absent'), destination);
    if (kind === 'unsafe-directory') { const unsafe = join(dirname(path), 'unsafe'); mkdirSync(unsafe); chmodSync(unsafe, 0o755); destination = join(unsafe, 'backup.sqlite'); }
    if (kind === 'sidecar') writeFileSync(destination + '-wal', '', { mode: 0o600 });
    if (kind === 'relative') destination = 'relative-backup.sqlite';
    const old = existsSync(destination) ? readFileSync(destination) : null;
    expect(() => source.backup(destination)).toThrow();
    expect(existsSync(destination) ? readFileSync(destination) : null).toEqual(old);
    expect(await observe(source.adapter)).toEqual(before); expect(source.listMaps()).toEqual(catalog);
  } finally { source.close(); }
});

test.each(['before', 'after', 'format'] as const)('D13: %s completion fault is never reported as a successful backup; source unchanged', async mode => {
  const path = fixture(); const destination = join(dirname(path), 'unconfirmed.sqlite');
  const lifecycle = sqliteLifecycleForTests({
    beforeBackup() { if (mode === 'before') { writeFileSync(destination, 'partial artifact', { mode: 0o600 }); throw new Error('Interrupted'); } },
    afterBackup() {
      if (mode === 'after') throw new Error('Completion interrupted');
      if (mode === 'format') { const db = new DatabaseSync(destination); db.exec('PRAGMA application_id=0'); db.close(); }
    },
  });
  lifecycle.initialize(path); const source = lifecycle.open(path);
  try {
    await seed(source.adapter); const before = await observe(source.adapter);
    expect(() => source.backup(destination)).toThrow('not a confirmed backup');
    expect(existsSync(destination)).toBe(true);
    expect(await observe(source.adapter)).toEqual(before);
    expect(() => source.backup(destination)).toThrow();
  } finally { source.close(); }
});

test('manual command fails safely with nonzero status for missing/invalid/private paths, without creating storage', () => {
  const path = fixture(); const destination = join(dirname(path), 'backup.sqlite');
  for (const args of [[], [path, destination], [path, destination, 'extra']]) {
    let output = '';
    try { execFileSync(process.execPath, ['dist/sqlite-backup.js', ...args], { encoding: 'utf8', stdio: 'pipe' }); }
    catch (error) { output = String((error as { stderr: string }).stderr); expect((error as { status: number }).status).toBe(1); }
    expect(output).toMatch(/Usage:|SQLite backup failed/);
    expect(output).not.toContain(path); expect(output).not.toContain(destination);
    expect(existsSync(path)).toBe(false); expect(existsSync(destination)).toBe(false);
  }
});
