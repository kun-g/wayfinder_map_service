import type { InvalidInput } from './types.js';
import { invalid, isPlainObject, validateId, validateObject } from './values.js';

export function validateMapContent(value: unknown, path: readonly (string | number)[]): InvalidInput | undefined {
  const shape = validateObject(value, path, ['id', 'text', 'references']);
  if (shape) return shape;
  if (!isPlainObject(value)) return invalid(path, 'Plain content item required');
  const identity = validateId(value.id, [...path, 'id']);
  if (identity) return identity;
  if (typeof value.text !== 'string' || value.text.trim() === '') return invalid([...path, 'text'], 'Nonblank text required');
  const references = value.references;
  const refsPath = [...path, 'references'];
  if (!Array.isArray(references) || Object.getPrototypeOf(references) !== Array.prototype) return invalid(refsPath, 'Plain Reference array required');
  for (const key of Reflect.ownKeys(references)) {
    if (key !== 'length' && (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key)
      || Number(key) >= references.length)) return invalid([...refsPath, String(key)], 'Unsupported array property');
  }
  for (let i = 0; i < references.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(references, String(i));
    const refPath = [...refsPath, i];
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return invalid(refPath, 'Plain Reference element required');
    const reference: unknown = descriptor.value;
    const shape = validateObject(reference, refPath, ['locator', 'label']);
    if (shape) return shape;
    if (!isPlainObject(reference)) return invalid(refPath, 'Plain Reference required');
    if (typeof reference.locator !== 'string' || reference.locator.trim() === '') return invalid([...refPath, 'locator'], 'Nonblank locator required');
    if (Object.hasOwn(reference, 'label') && typeof reference.label !== 'string') return invalid([...refPath, 'label'], 'String label required');
  }
}
