import type { StoredMapState, TicketId } from './types.js';

export function calculateFrontier(current: StoredMapState): readonly TicketId[] {
  const tickets = new Map(current.tickets.map(ticket => [ticket.id, ticket]));
  return Object.freeze(current.tickets.filter(ticket => ticket.status === 'open' && ticket.claim === null
    && ticket.prerequisites.every(identity => tickets.get(identity)?.status === 'settled'))
    .map(ticket => ticket.id).sort());
}
