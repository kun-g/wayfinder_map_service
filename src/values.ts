import type { Id, InvalidInput, Result } from './types.js';

export function invalid(path: readonly (string | number)[], constraint: string): InvalidInput {
  return { code: 'invalid_input', path, constraint };
}

export function parseId<K extends string>(_kind: K, input: unknown): Result<Id<K>, InvalidInput> {
  const error = validateId(input, []);
  return error ? { kind: 'error', error } : { kind: 'ok', value: input as Id<K> };
}

export function validateId(input: unknown, path: readonly (string | number)[]): InvalidInput | undefined {
  if (typeof input !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(input)
    || input.length > 128 || /[\r\n]/.test(input)) {
    return invalid(path, '1–128 ASCII ID characters required');
  }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

export function validateObject(
  value: unknown, path: readonly (string | number)[], allowed?: readonly string[],
): InvalidInput | undefined {
  if (!isPlainObject(value)) return invalid(path, 'Plain object required');
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (typeof key !== 'string' || (allowed !== undefined && !allowed.includes(key))) {
      return invalid([...path, String(key)], 'Unsupported field');
    }
    if (!descriptor.enumerable || !('value' in descriptor)) {
      return invalid([...path, key], 'Plain data property required');
    }
  }
}

export function validateArrayShape(value: readonly unknown[], path: readonly (string | number)[]): InvalidInput | undefined {
  if (Object.getPrototypeOf(value) !== Array.prototype) return invalid(path, 'Plain array required');
  for (const key of Reflect.ownKeys(value)) {
    if (key !== 'length' && (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key)
      || Number(key) >= value.length)) return invalid([...path, String(key)], 'Unsupported array property');
  }
  for (let i = 0; i < value.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return invalid([...path, i], 'Plain array element required');
  }
}

export function validateExtensions(value: unknown, path: readonly (string | number)[] = ['extensions']): InvalidInput | undefined {
  const error = validateObject(value, path);
  if (error) return error;
  for (const key of Object.keys(value as object)) {
    const match = /^[a-z][a-z0-9_-]*\.[a-z][a-z0-9_.-]*$/.exec(key);
    if (!match || match[0] !== key) return invalid([...path, key], 'Namespaced extension key required');
  }
  return validateJson(value, path, new Set());
}

export function validateAuthor(value: unknown): InvalidInput | undefined {
  const shape = validateObject(value, ['author'], ['actorId', 'clientId', 'occurredAt']);
  if (shape) return shape;
  if (!isPlainObject(value)) return invalid(['author'], 'Caller author required');
  for (const key of ['actorId', 'clientId']) {
    const error = validateId(value[key], ['author', key]);
    if (error) return error;
  }
  if (!isUtcTimestamp(value.occurredAt)) return invalid(['author', 'occurredAt'], 'UTC RFC3339 timestamp required');
}

function validateJson(
  value: unknown, path: readonly (string | number)[], ancestors: Set<object>,
): InvalidInput | undefined {
  if (value === null || typeof value === 'string' || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value))) return;
  if (typeof value !== 'object' || value === null) return invalid(path, 'Finite plain JSON required');
  if (ancestors.has(value)) return invalid(path, 'Acyclic JSON required');
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const shapeError = validateArrayShape(value, path);
      if (shapeError) return shapeError;
      for (let i = 0; i < value.length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(i))!;
        const error = validateJson(descriptor.value, [...path, i], ancestors);
        if (error) return error;
      }
      return;
    }
    const error = validateObject(value, path);
    if (error) return error;
    for (const [key, entry] of Object.entries(value)) {
      const error = validateJson(entry, [...path, key], ancestors);
      if (error) return error;
    }
  } finally {
    ancestors.delete(value);
  }
}

export function isUtcTimestamp(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  // RFC 3339 §4.3: -00:00 also expresses a known UTC time (unknown local offset).
  const parts = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|[+-]00:00)$/.exec(value);
  if (!parts || parts[0] !== value) return false;
  const year = Number(parts[1]), month = Number(parts[2]), day = Number(parts[3]);
  const hour = Number(parts[4]), minute = Number(parts[5]), second = Number(parts[6]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (days === undefined || day < 1 || day > days || hour > 23 || minute > 59) return false;
  const leapSecond = second === 60 && hour === 23 && minute === 59
    && ((month === 6 && day === 30) || (month === 12 && day === 31));
  return second <= 59 || leapSecond;
}
