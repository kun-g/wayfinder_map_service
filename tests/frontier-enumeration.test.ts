import { expect, test } from 'vitest';
import { calculateFrontier, createMemoryAdapter, parseId, prepareApply, prepareCreate } from '../src/index.js';
import type { StoredMapState, StoredTicket } from '../src/index.js';

function id<K extends string>(kind: K, value: string) {
  const parsed = parseId(kind, value);
  if (parsed.kind !== 'ok') throw new Error('Invalid enumeration fixture');
  return parsed.value;
}
const labels = ['z', 'A', 'a', '0'];
const mapId = id('Map', 'Enumeration');
const otherId = id('Map', 'Other');
const author = { actorId: id('Actor', 'kun'), clientId: id('Client', 'codex'), occurredAt: '2026-09-18T04:00:00Z' };

// This oracle uses a Boolean adjacency matrix and transitive closure, unlike
// production's Ticket lookup/topological elimination. No production helpers.
function closure(matrix: boolean[][]): boolean[][] {
  const reachable = matrix.map(row => [...row]);
  for (let via = 0; via < matrix.length; via++) {
    for (let from = 0; from < matrix.length; from++) {
      for (let to = 0; to < matrix.length; to++) {
        reachable[from]![to] = reachable[from]![to]! || (reachable[from]![via]! && reachable[via]![to]!);
      }
    }
  }
  return reachable;
}
function fixtureTicket(index: number, state: number, row: boolean[]): StoredTicket {
  const base = { id: id('Ticket', labels[index]!), title: 'Work', question: 'Why?', type: 'task' as const,
    extensions: {}, prerequisites: row.flatMap((edge, target) => edge ? [id('Ticket', labels[target]!)] : []) };
  if (state === 2) return { ...base, status: 'settled', claim: null, settlement: {
    outcome: { kind: 'completion', statement: 'Accepted completion' }, evidence: [], references: [],
    provenance: { method: 'enumeration fixture', sources: [] }, extensions: {}, introducedAtRevision: 1,
  } };
  return { ...base, status: 'open', claim: state === 1 ? id('Claimant', 'session') : null };
}

test.each([0, 1, 2, 3, 4])('G07: exhaustively enumerate %i-node local graphs and legal status/Claim assignments against an independent oracle', async size => {
  const adapter = createMemoryAdapter();
  for (const identity of [mapId, otherId]) {
    const prepared = prepareCreate({ id: identity, title: 'Original', destination: 'Arrive', author });
    if (prepared.kind !== 'ok') throw new Error('Expected creation');
    await adapter.commit(prepared.value);
  }
  const current = await adapter.readCurrent(mapId);
  if (current.kind !== 'found') throw new Error('Expected current Map');
  const observe = async () => structuredClone(await Promise.all([mapId, otherId].map(async identity => ({
    current: await adapter.readCurrent(identity), first: await adapter.readRevision(identity, 1),
    proposed: await adapter.readRevision(identity, 2),
  }))));
  const before = await observe();
  const edges = Array.from({ length: size }, (_, dependent) => Array.from({ length: size }, (_, prerequisite) =>
    [dependent, prerequisite] as const)).flat().filter(([from, to]) => from !== to);
  let graphs = 0, acyclic = 0, rejectedCycles = 0, legalAssignments = 0;
  for (let mask = 0; mask < 2 ** edges.length; mask++) {
    graphs++;
    const matrix = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
    edges.forEach(([from, to], bit) => { matrix[from]![to] = (mask & (1 << bit)) !== 0; });
    const cyclic = closure(matrix).some((row, index) => row[index]);
    const apply = (fixture: StoredMapState) => prepareApply(fixture, {
      mapId, expectedRevision: 1, author, commands: [{ kind: 'map.update', patch: { title: 'Enumerated' } }],
    });
    if (cyclic) {
      rejectedCycles++;
      const fixture = { ...current.value, tickets: matrix.map((row, index) => fixtureTicket(index, 0, row)) };
      const original = structuredClone(fixture);
      const result = apply(fixture);
      expect(result).toMatchObject({ kind: 'rejected', rejection: { stage: 'final_state', code: 'dependency_cycle' } });
      if (result.kind !== 'rejected' || result.rejection.stage !== 'final_state' || result.rejection.code !== 'dependency_cycle') {
        throw new Error(`Expected cycle rejection for size=${size}, mask=${mask}`);
      }
      expect(result.rejection.ticketIds.length).toBeGreaterThan(0);
      expect(fixture).toEqual(original);
      expect(await observe()).toEqual(before);
      continue;
    }
    acyclic++;
    for (let assignment = 0; assignment < 3 ** size; assignment++) {
      // 0 = open/unclaimed, 1 = open/claimed, 2 = settled/unclaimed.
      const states = Array.from({ length: size }, (_, index) => Math.floor(assignment / 3 ** index) % 3);
      const legal = matrix.every((row, dependent) => states[dependent] === 0
        || row.every((edge, prerequisite) => !edge || states[prerequisite] === 2));
      if (!legal) continue;
      legalAssignments++;
      const expected = labels.slice(0, size).filter((_, dependent) => states[dependent] === 0
        && matrix[dependent]!.every((edge, prerequisite) => !edge || states[prerequisite] === 2))
        .sort((left, right) => left.charCodeAt(0) - right.charCodeAt(0));
      const fixture = { ...current.value, tickets: matrix.map((row, index) => fixtureTicket(index, states[index]!, row)) };
      const original = structuredClone(fixture);
      expect(calculateFrontier(fixture)).toEqual(expected);
      const result = apply(fixture);
      expect(result.kind).toBe('prepared');
      if (result.kind !== 'prepared') throw new Error(`Expected legal fixture size=${size}, mask=${mask}, assignment=${assignment}`);
      expect(result.frontier).toEqual(expected);
      expect(result.change.next).toEqual({ ...fixture, title: 'Enumerated', currentRevision: 2 });
      expect(fixture).toEqual(original);
    }
  }
  expect(graphs).toBe(2 ** (size * (size - 1)));
  expect(acyclic + rejectedCycles).toBe(graphs);
  expect(legalAssignments).toBeGreaterThanOrEqual(3 ** size); // At least every assignment on the edgeless graph.
  if (size >= 2) expect(rejectedCycles).toBeGreaterThan(0);
  expect(await observe()).toEqual(before);
}, 30_000);
