import type { InvalidInput } from './types.js';
import { invalid, isPlainObject, validateArrayShape, validateObject } from './values.js';

export function validateReferences(value: unknown, path: readonly (string | number)[]): InvalidInput | undefined {
  if (!Array.isArray(value)) return invalid(path, 'Plain Reference array required');
  const shape = validateArrayShape(value, path);
  if (shape) return shape;
  for (let i = 0; i < value.length; i++) {
    const item: unknown = Object.getOwnPropertyDescriptor(value, String(i))!.value;
    const itemPath = [...path, i];
    const shape = validateObject(item, itemPath, ['locator', 'label']);
    if (shape) return shape;
    if (!isPlainObject(item)) return invalid(itemPath, 'Plain Reference required');
    if (typeof item.locator !== 'string' || item.locator.trim() === '') return invalid([...itemPath, 'locator'], 'Nonblank locator required');
    if (Object.hasOwn(item, 'label') && typeof item.label !== 'string') return invalid([...itemPath, 'label'], 'String label required');
  }
}
