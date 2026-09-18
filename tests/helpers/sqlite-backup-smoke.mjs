import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { initializeSQLite, openSQLite } from '../../dist/sqlite-storage.js';
import { prepareCreate, prepareApply } from '../../dist/index.js';

// Explicit disposable operator-path acceptance. Never uses an existing DB.
// Configure a private local test root outside repositories and temporary roots.
const root = process.env.WAYFINDER_MAINTENANCE_TEST_ROOT;
if (!root) throw new Error('Private maintenance acceptance root required');
const directory = realpathSync(mkdtempSync(join(root, 'wayfinder-backup-acceptance-')));
try {
  const source = join(directory, 'source', 'maps.sqlite');
  const target = join(directory, 'backup', 'snapshot.sqlite');
  initializeSQLite(source);
  const storage = openSQLite(source);
  try {
    const initial = prepareCreate({ id: 'Acceptance', title: 'Acceptance only', destination: 'Manual backup proof',
      author: { actorId: 'operator', clientId: 'acceptance', occurredAt: '2026-09-18T12:00:00Z' } });
    assert.equal(initial.kind, 'ok'); await storage.adapter.commit(initial.value);
    const claim = prepareApply(initial.value.next, { mapId: 'Acceptance', expectedRevision: 1, author: initial.value.author,
      commands: [{ kind: 'ticket.create', ticket: { id: 'Retained', title: 'Retained', question: 'Continue?', type: 'task' } },
        { kind: 'claim.acquire', ticketId: 'Retained', claimantId: 'acceptance:work' }] });
    assert.equal(claim.kind, 'prepared'); await storage.adapter.commit(claim.change);
    const before = await storage.adapter.readCurrent('Acceptance');
    const history = await storage.adapter.readRevision('Acceptance', 1);
    const output = execFileSync('npm', ['run', '--silent', 'backup', '--', source, target], { encoding: 'utf8', stdio: 'pipe' });
    assert.match(output, /SQLite backup completed/);
    assert.equal(output.includes(source) || output.includes(target), false);
    const independent = openSQLite(target);
    try {
      assert.deepEqual(await independent.adapter.readCurrent('Acceptance'), before);
      assert.deepEqual(await independent.adapter.readRevision('Acceptance', 1), history);
      assert.deepEqual(await independent.adapter.readRevision('Acceptance', 2), await storage.adapter.readRevision('Acceptance', 2));
    } finally { independent.close(); }
    assert.deepEqual(await storage.adapter.readCurrent('Acceptance'), before);
    assert.deepEqual(await storage.adapter.readRevision('Acceptance', 1), history);
    let refused = false;
    try { execFileSync('npm', ['run', '--silent', 'backup', '--', source, target], { stdio: 'pipe' }); }
    catch (error) {
      assert.equal(error.status, 1); assert.match(String(error.stderr), /no confirmed backup/);
      const diagnostics = String(error.stdout) + String(error.stderr);
      assert.equal(diagnostics.includes(source) || diagnostics.includes(target), false);
      refused = true;
    }
    assert.equal(refused, true);
    assert.deepEqual(await storage.adapter.readCurrent('Acceptance'), before);
    console.log('Manual backup command: success, independent history/Claim comparison, existing-target refusal passed');
  } finally { storage.close(); }
} finally {
  // Only the fresh mkdtemp fixture is removed, never the configured root.
  rmSync(directory, { recursive: true });
}
