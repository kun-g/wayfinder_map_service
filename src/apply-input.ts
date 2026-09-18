import type { ApplyRequest, InvalidInput, Result } from './types.js';
import { invalid, isPlainObject, validateAuthor, validateExtensions, validateId, validateObject } from './values.js';
import { immutableClone } from './immutable.js';

export function decodeApplyRequest(raw: unknown): Result<ApplyRequest, InvalidInput> {
  const error = validateRequest(raw);
  return error ? { kind: 'error', error } : { kind: 'ok', value: immutableClone(raw as ApplyRequest) };
}

function validateRequest(raw: unknown): InvalidInput | undefined {
  const shape = validateObject(raw, [], ['mapId', 'expectedRevision', 'author', 'commands']);
  if (shape) return shape;
  if (!isPlainObject(raw)) return invalid([], 'Plain request required');
  const identity = validateId(raw.mapId, ['mapId']);
  if (identity) return identity;
  if (typeof raw.expectedRevision !== 'number' || !Number.isSafeInteger(raw.expectedRevision) || raw.expectedRevision <= 0) {
    return invalid(['expectedRevision'], 'Positive safe integer required');
  }
  const authorError = validateAuthor(raw.author);
  if (authorError) return authorError;
  const commands = raw.commands;
  if (!Array.isArray(commands) || Object.getPrototypeOf(commands) !== Array.prototype || commands.length === 0) {
    return invalid(['commands'], 'Nonempty plain command array required');
  }
  for (const key of Reflect.ownKeys(commands)) {
    if (key !== 'length' && (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key)
      || Number(key) >= commands.length)) return invalid(['commands', String(key)], 'Unsupported array property');
  }
  for (let i = 0; i < commands.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(commands, String(i));
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return invalid(['commands', i], 'Plain command element required');
    const command: unknown = descriptor.value;
    const path = ['commands', i] as const;
    const shape = validateObject(command, path, ['kind', 'patch']);
    if (shape) return shape;
    if (!isPlainObject(command)) return invalid(path, 'Plain command required');
    if (command.kind !== 'map.update') return invalid([...path, 'kind'], 'Unsupported command kind');
    const patchPath = [...path, 'patch'];
    const patchShape = validateObject(command.patch, patchPath, ['title', 'destination', 'notes', 'extensions']);
    if (patchShape) return patchShape;
    if (!isPlainObject(command.patch)) return invalid(patchPath, 'Plain patch required');
    const patch = command.patch;
    if (Object.keys(patch).length === 0) return invalid(patchPath, 'Nonempty patch required');
    for (const key of ['title', 'destination']) {
      if (Object.hasOwn(patch, key) && (typeof patch[key] !== 'string' || patch[key].trim() === '')) {
        return invalid([...patchPath, key], 'Nonblank text required');
      }
    }
    if (Object.hasOwn(patch, 'notes') && typeof patch.notes !== 'string') return invalid([...patchPath, 'notes'], 'String required');
    if (Object.hasOwn(patch, 'extensions')) {
      const error = validateExtensions(patch.extensions, [...patchPath, 'extensions']);
      if (error) return error;
    }
  }
}
