import type { CreateMapInput, InvalidInput, MapId, MutationAuthor, NonEmpty, Result, SemanticChange, StoredMapState } from './types.js';
import { invalid, isPlainObject, isUtcTimestamp, validateExtensions, validateId, validateObject } from './values.js';
import { immutableClone } from './immutable.js';

const preparedBrand: unique symbol = Symbol('PreparedCommit');
export interface PreparedCommit {
  readonly [preparedBrand]: true;
  readonly kind: 'create';
  readonly priorRevision: null;
  readonly mapId: MapId;
  readonly next: StoredMapState;
  readonly author: MutationAuthor;
  readonly changes: NonEmpty<SemanticChange>;
}

export function prepareCreate(input: CreateMapInput): Result<PreparedCommit, InvalidInput> {
  const error = validateCreate(input);
  if (error) return { kind: 'error', error };
  const prepared: PreparedCommit = {
    [preparedBrand]: true, kind: 'create', priorRevision: null, mapId: input.id,
    next: {
      id: input.id, title: input.title, destination: input.destination,
      notes: input.notes ?? '', extensions: input.extensions ?? {},
      fog: [], scopeExclusions: [], tickets: [], currentRevision: 1,
    },
    author: input.author,
    changes: [{ commandIndex: 0, command: 'map.create', subjectId: input.id }],
  };
  return { kind: 'ok', value: Object.freeze({
    ...immutableClone(prepared), [preparedBrand]: true as const,
  }) };
}

function validateCreate(input: unknown): InvalidInput | undefined {
  const shapeError = validateObject(input, [], ['id', 'title', 'destination', 'notes', 'extensions', 'author']);
  if (shapeError) return shapeError;
  if (!isPlainObject(input)) return invalid([], 'Plain create object required');
  const idError = validateId(input.id, ['id']);
  if (idError) return idError;
  for (const key of ['title', 'destination']) {
    if (typeof input[key] !== 'string' || input[key].trim() === '') {
      return invalid([key], 'Nonblank text required');
    }
  }
  if (Object.hasOwn(input, 'notes') && typeof input.notes !== 'string') {
    return invalid(['notes'], 'String notes required');
  }
  if (Object.hasOwn(input, 'extensions')) {
    const error = validateExtensions(input.extensions);
    if (error) return error;
  }
  const authorError = validateObject(input.author, ['author'], ['actorId', 'clientId', 'occurredAt']);
  if (authorError) return authorError;
  if (!isPlainObject(input.author)) return invalid(['author'], 'Caller author required');
  for (const key of ['actorId', 'clientId']) {
    const error = validateId(input.author[key], ['author', key]);
    if (error) return error;
  }
  if (!isUtcTimestamp(input.author.occurredAt)) {
    return invalid(['author', 'occurredAt'], 'UTC RFC3339 timestamp required');
  }
}
