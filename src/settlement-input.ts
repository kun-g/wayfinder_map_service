import type { InvalidInput, TicketType } from './types.js';
import { invalid, isPlainObject, validateArrayShape, validateExtensions, validateJsonObject, validateObject } from './values.js';

type Path = readonly (string | number)[];
export function validateSettlement(value: unknown, ticketType: TicketType, path: Path): InvalidInput | undefined {
  const shape = validateObject(value, path, ['outcome', 'evidence', 'references', 'provenance', 'extensions']);
  if (shape) return shape;
  if (!isPlainObject(value)) return invalid(path, 'Plain Settlement required');
  const outcomePath = [...path, 'outcome'];
  const decision = ticketType === 'grilling' || ticketType === 'prototype';
  const outcomeShape = validateObject(value.outcome, outcomePath, decision ? ['kind', 'statement', 'rationale']
    : ticketType === 'research' ? ['kind', 'statement', 'limitations'] : ['kind', 'statement', 'resultingFacts']);
  if (outcomeShape) return outcomeShape;
  if (!isPlainObject(value.outcome)) return invalid(outcomePath, 'Plain outcome required');
  const outcome = value.outcome;
  const expected = decision ? 'decision' : ticketType === 'research' ? 'finding' : 'completion';
  if (outcome.kind !== expected) return invalid([...outcomePath, 'kind'], 'Outcome must match command Ticket type');
  for (const key of decision ? ['statement', 'rationale'] : ['statement']) {
    if (typeof outcome[key] !== 'string' || outcome[key].trim() === '') return invalid([...outcomePath, key], 'Nonblank text required');
  }
  if (Object.hasOwn(outcome, 'limitations') && typeof outcome.limitations !== 'string') return invalid([...outcomePath, 'limitations'], 'String limitations required');
  if (Object.hasOwn(outcome, 'resultingFacts')) {
    const error = validateJsonObject(outcome.resultingFacts, [...outcomePath, 'resultingFacts']);
    if (error) return error;
  }
  const evidence = value.evidence;
  const evidencePath = [...path, 'evidence'];
  if (!Array.isArray(evidence)) return invalid(evidencePath, 'Plain Evidence array required');
  const evidenceShape = validateArrayShape(evidence, evidencePath);
  if (evidenceShape) return evidenceShape;
  for (let i = 0; i < evidence.length; i++) {
    const itemPath = [...evidencePath, i];
    const item: unknown = Object.getOwnPropertyDescriptor(evidence, String(i))!.value;
    const shape = validateObject(item, itemPath, ['statement', 'references', 'provenance', 'extensions']);
    if (shape) return shape;
    if (!isPlainObject(item)) return invalid(itemPath, 'Plain Evidence required');
    if (typeof item.statement !== 'string' || item.statement.trim() === '') return invalid([...itemPath, 'statement'], 'Nonblank statement required');
    const references = validateReferences(item.references, [...itemPath, 'references']);
    if (references) return references;
    if (Object.hasOwn(item, 'provenance') || (item.references as unknown[]).length === 0) {
      const error = validateProvenance(item.provenance, [...itemPath, 'provenance']);
      if (error) return error;
    }
    const extensions = validateExtensions(item.extensions, [...itemPath, 'extensions']);
    if (extensions) return extensions;
  }
  const references = validateReferences(value.references, [...path, 'references']);
  if (references) return references;
  if (ticketType === 'research' && evidence.length === 0 && (value.references as unknown[]).length === 0) return invalid(evidencePath, 'Finding requires Evidence or Reference');
  return validateProvenance(value.provenance, [...path, 'provenance']) ?? validateExtensions(value.extensions, [...path, 'extensions']);
}

function validateProvenance(value: unknown, path: Path): InvalidInput | undefined {
  const shape = validateObject(value, path, ['method', 'sources']);
  if (shape) return shape;
  if (!isPlainObject(value)) return invalid(path, 'Plain Provenance required');
  if (typeof value.method !== 'string' || value.method.trim() === '') return invalid([...path, 'method'], 'Nonblank method required');
  return validateReferences(value.sources, [...path, 'sources']);
}

function validateReferences(value: unknown, path: Path): InvalidInput | undefined {
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
