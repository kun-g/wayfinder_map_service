import type { InvalidInput } from './types.js';
import { invalid, isPlainObject, validateArrayShape, validateId, validateObject } from './values.js';

export function validateMapContent(value: unknown, path: readonly (string | number)[]): InvalidInput | undefined {
  const shape = validateObject(value, path, ['id', 'text', 'references']);
  if (shape) return shape;
  if (!isPlainObject(value)) return invalid(path, 'Plain content item required');
  const identity = validateId(value.id, [...path, 'id']);
  if (identity) return identity;
  if (typeof value.text !== 'string' || value.text.trim() === '') return invalid([...path, 'text'], 'Nonblank text required');
  const references = value.references;
  const refsPath = [...path, 'references'];
  if (!Array.isArray(references)) return invalid(refsPath, 'Plain Reference array required');
  const arrayShape = validateArrayShape(references, refsPath);
  if (arrayShape) return arrayShape;
  for (let i = 0; i < references.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(references, String(i))!;
    const refPath = [...refsPath, i];
    const reference: unknown = descriptor.value;
    const shape = validateObject(reference, refPath, ['locator', 'label']);
    if (shape) return shape;
    if (!isPlainObject(reference)) return invalid(refPath, 'Plain Reference required');
    if (typeof reference.locator !== 'string' || reference.locator.trim() === '') return invalid([...refPath, 'locator'], 'Nonblank locator required');
    if (Object.hasOwn(reference, 'label') && typeof reference.label !== 'string') return invalid([...refPath, 'label'], 'String label required');
  }
}
