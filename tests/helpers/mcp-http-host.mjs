// Test-only child host. No production entry point or public fault tool imports this.
import { sqliteLifecycleForTests } from '../../dist/sqlite-internal.js';
import { serveLocalMcp } from '../../dist/mcp-http-internal.js';

const [path, port, mode] = process.argv.slice(2);
let armed = false;
function pause() {
  if (!armed) return;
  process.send({ kind: 'boundary', boundary: mode });
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
}
const storage = sqliteLifecycleForTests({ beforePublication: mode === 'before' ? pause : undefined,
  afterPublication: mode === 'after' ? pause : undefined,
}).open(path);
let release;
const managed = mode === 'graceful' ? { ...storage, adapter: { ...storage.adapter, async commit(change) {
  if (armed) {
    process.send({ kind: 'boundary', boundary: 'active' });
    await new Promise(resolve => { release = resolve; });
  }
  return storage.adapter.commit(change);
} } } : storage;
const service = await serveLocalMcp(managed, { databasePath: path, port: Number(port),
  token: 'isolated-test-token-not-a-live-credential', actorId: 'operator', clientId: 'http-acceptance',
});
process.on('message', message => {
  if (message === 'arm') { armed = true; process.send({ kind: 'armed' }); }
  if (message === 'release') release?.();
});
process.on('SIGTERM', () => {
  const stopping = service.stop();
  process.send({ kind: 'stopping' });
  void stopping.then(() => process.disconnect());
});
process.send({ kind: 'ready' });
