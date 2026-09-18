import type { PreparedCommit } from './create.js';
import type { Revision } from './types.js';
import { immutableClone } from './immutable.js';
import { isPlainObject, validateId } from './values.js';

// Shared internal value handling, not a storage/public import seam.
export function capturePrepared(prepared: PreparedCommit): PreparedCommit {
  const captured = immutableClone(prepared);
  if (!isPlainObject(captured) || validateId(captured.mapId, ['mapId']) || !isPlainObject(captured.next)
    || captured.next.id !== captured.mapId
    || (captured.kind === 'create' ? captured.priorRevision !== null || captured.next.currentRevision !== 1
      : captured.kind !== 'apply' || !Number.isSafeInteger(captured.priorRevision) || captured.priorRevision <= 0
        || !Number.isSafeInteger(captured.next.currentRevision) || captured.next.currentRevision !== captured.priorRevision + 1)) {
    throw new TypeError('Malformed internal PreparedCommit envelope');
  }
  return captured;
}

export function revisionFromPrepared(captured: PreparedCommit): Revision {
  return immutableClone({ mapId: captured.mapId, revision: captured.next.currentRevision,
    priorRevision: captured.priorRevision, kind: captured.kind, author: captured.author,
    changes: captured.changes, state: captured.next });
}
