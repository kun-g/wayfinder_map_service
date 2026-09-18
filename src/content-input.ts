import type { InvalidInput } from './types.js';
import { invalid, isPlainObject, validateId, validateObject } from './values.js';
import { validateReferences } from './reference-input.js';

export function validateMapContent(value: unknown, path: readonly (string | number)[]): InvalidInput | undefined {
  const shape = validateObject(value, path, ['id', 'text', 'references']);
  if (shape) return shape;
  if (!isPlainObject(value)) return invalid(path, 'Plain content item required');
  const identity = validateId(value.id, [...path, 'id']);
  if (identity) return identity;
  if (typeof value.text !== 'string' || value.text.trim() === '') return invalid([...path, 'text'], 'Nonblank text required');
  return validateReferences(value.references, [...path, 'references']);
}
