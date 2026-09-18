import { sqliteLifecycleForTests } from '../../dist/sqlite-internal.js';
import { prepareApply } from '../../dist/index.js';

const [path, mode] = process.argv.slice(2);
function pause() {
  process.send({ kind: 'boundary', boundary: mode });
  // send() writes this small boundary message to the IPC pipe before we block
  // synchronously inside the publication hook. The parent kills only after
  // receiving it; no timer or scheduler race chooses the fault boundary.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
}
const storage = sqliteLifecycleForTests({
  beforePublication: mode === 'before' ? pause : undefined,
  afterPublication: mode === 'after' ? pause : undefined,
}).open(path);
if (mode === 'before' || mode === 'after') {
  const current = await storage.adapter.readCurrent('Alpha');
  const original = await storage.adapter.readRevision('Alpha', 1);
  if (current.kind !== 'found' || original.kind !== 'found') throw new Error('Invalid fixture');
  const proposal = prepareApply(current.value, { mapId: 'Alpha', expectedRevision: current.value.currentRevision,
    author: original.value.author, commands: [{ kind: 'map.update', patch: { notes: 'host commit' } }] });
  if (proposal.kind !== 'prepared') throw new Error('Invalid proposal');
  const receipt = await storage.adapter.commit(proposal.change);
  process.send({ kind: 'receipt', receipt });
} else {
  process.on('message', message => {
    if (message === 'close') { storage.close(); process.disconnect(); }
  });
  process.send({ kind: 'ready', current: await storage.adapter.readCurrent('Alpha') });
}
