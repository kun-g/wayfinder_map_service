import type { PreparedCommit } from './create.js';
import type { CommitResult, MapId, ReadResult, Revision, RevisionNumber, StoredMapState } from './types.js';
import { invalid, isPlainObject, validateId } from './values.js';
import { immutableClone } from './immutable.js';

export interface StateAdapter {
  readCurrent(mapId: MapId): Promise<ReadResult<StoredMapState>>;
  readRevision(mapId: MapId, revision: RevisionNumber): Promise<ReadResult<Revision>>;
  commit(prepared: PreparedCommit): Promise<CommitResult>;
}

export function createMemoryAdapter(): StateAdapter {
  const records = new Map<MapId, Revision>();
  return {
    async readCurrent(mapId) {
      const error = validateId(mapId, ['mapId']);
      if (error) return { kind: 'rejected', error };
      const record = records.get(mapId);
      return record ? { kind: 'found', value: record.state }
        : { kind: 'not_found', code: 'map_not_found', mapId };
    },
    async readRevision(mapId, revision) {
      const error = validateId(mapId, ['mapId']);
      if (error) return { kind: 'rejected', error };
      if (!Number.isSafeInteger(revision) || revision <= 0) {
        return { kind: 'rejected', error: invalid(['revision'], 'Positive safe integer required') };
      }
      const record = records.get(mapId);
      if (!record) return { kind: 'not_found', code: 'map_not_found', mapId };
      return revision === 1 ? { kind: 'found', value: record }
        : { kind: 'not_found', code: 'revision_not_found', mapId, revision };
    },
    async commit(prepared) {
      // Capture before any possible async yield; check and publication have no gap.
      const captured = immutableClone(prepared);
      if (!isPlainObject(captured) || captured.kind !== 'create' || captured.priorRevision !== null
        || validateId(captured.mapId, ['mapId']) || !isPlainObject(captured.next)
        || captured.next.id !== captured.mapId || captured.next.currentRevision !== 1) {
        throw new TypeError('Malformed internal PreparedCommit envelope');
      }
      if (records.has(captured.mapId)) {
        return { kind: 'rejected', code: 'map_already_exists', mapId: captured.mapId };
      }
      const revision: Revision = immutableClone({
        mapId: captured.mapId, revision: 1, priorRevision: null, kind: 'create',
        author: captured.author, changes: captured.changes, state: captured.next,
      });
      records.set(captured.mapId, revision);
      return { kind: 'committed', revision, frontier: [] };
    },
  };
}
