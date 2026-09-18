// Copy first: freezing must never change the caller's input objects.
export function immutableClone<T>(value: T): T {
  return freeze(structuredClone(value));
}

function freeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
