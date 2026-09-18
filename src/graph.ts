import type { InvariantRejection, StoredMapState, TicketId } from './types.js';

export function checkFinalGraph(state: StoredMapState): InvariantRejection | undefined {
  const tickets = new Map(state.tickets.map(ticket => [ticket.id, ticket]));
  const remaining = new Map<TicketId, number>();
  const dependents = new Map<TicketId, TicketId[]>();
  for (const ticket of state.tickets) {
    remaining.set(ticket.id, ticket.prerequisites.length);
    for (const prerequisite of ticket.prerequisites) {
      if (!tickets.has(prerequisite)) return { stage: 'final_state', code: 'dangling_dependency', ticketIds: [ticket.id, prerequisite] };
      const children = dependents.get(prerequisite) ?? [];
      children.push(ticket.id);
      dependents.set(prerequisite, children);
    }
  }
  // Iterative topological elimination avoids recursion limits on caller-sized Maps.
  const ready = [...remaining].filter(([, count]) => count === 0).map(([identity]) => identity);
  for (let cursor = 0; cursor < ready.length; cursor++) {
    for (const dependent of dependents.get(ready[cursor]!) ?? []) {
      const count = remaining.get(dependent)! - 1;
      remaining.set(dependent, count);
      if (count === 0) ready.push(dependent);
    }
  }
  if (ready.length !== state.tickets.length) return { stage: 'final_state', code: 'dependency_cycle',
    ticketIds: [...remaining].filter(([, count]) => count > 0).map(([identity]) => identity).sort() };
  for (const ticket of state.tickets) {
    if (ticket.status !== 'settled' && ticket.claim === null) continue;
    const open = ticket.prerequisites.find(identity => tickets.get(identity)!.status !== 'settled');
    if (open !== undefined) return { stage: 'final_state', code: ticket.status === 'settled'
      ? 'settled_ticket_has_open_prerequisite' : 'claimed_ticket_has_open_prerequisite', ticketIds: [ticket.id, open] };
  }
}
