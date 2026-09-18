import type { Command, CommandErrorCode, CommandRejection, Result, StoredMapState, TicketId } from './types.js';

export function applyCommand(state: StoredMapState, command: Command, commandIndex: number): Result<StoredMapState, CommandRejection> {
  const reject = (code: CommandErrorCode, ...ticketIds: TicketId[]): Result<StoredMapState, CommandRejection> => ({
    kind: 'error', error: { stage: 'command', commandIndex, code, ticketIds },
  });
  if (command.kind === 'map.update') return { kind: 'ok', value: { ...state, ...command.patch } };
  if (command.kind === 'content.add' || command.kind === 'content.update' || command.kind === 'content.remove') {
    const items = state[command.section];
    if (command.kind === 'content.add') {
      if ([...state.fog, ...state.scopeExclusions].some(item => item.id === command.item.id)) return reject('content_already_exists');
      return { kind: 'ok', value: { ...state, [command.section]: [...items, command.item] } };
    }
    const identity = command.kind === 'content.remove' ? command.itemId : command.item.id;
    if (!items.some(item => item.id === identity)) return reject('content_not_found');
    const updated = command.kind === 'content.remove' ? items.filter(item => item.id !== identity)
      : items.map(item => item.id === identity ? command.item : item);
    return { kind: 'ok', value: { ...state, [command.section]: updated } };
  }
  if (command.kind === 'ticket.create') {
    if (state.tickets.some(ticket => ticket.id === command.ticket.id)) return reject('ticket_already_exists', command.ticket.id);
    return { kind: 'ok', value: { ...state, tickets: [...state.tickets, {
      ...command.ticket, extensions: command.ticket.extensions ?? {}, prerequisites: [], status: 'open', claim: null,
    }] } };
  }
  const identity = command.kind === 'ticket.update' ? command.ticketId : command.dependentId;
  const ticket = state.tickets.find(ticket => ticket.id === identity);
  if (!ticket) return reject('ticket_not_found', identity);
  if (ticket.status !== 'open') return reject('ticket_not_open', ticket.id);
  if (ticket.claim !== null) {
    if (!command.claimantId) return reject('claim_required', ticket.id);
    if (command.claimantId !== ticket.claim) return reject('claim_mismatch', ticket.id);
  }
  let updated = ticket;
  if (command.kind === 'ticket.update') updated = { ...ticket, ...command.patch };
  else {
    if (!state.tickets.some(prerequisite => prerequisite.id === command.prerequisiteId)) return reject('ticket_not_found', command.prerequisiteId);
    if (command.dependentId === command.prerequisiteId) return reject('self_dependency', ticket.id);
    const exists = ticket.prerequisites.includes(command.prerequisiteId);
    if (command.kind === 'dependency.add' && exists) return reject('dependency_already_exists', ticket.id, command.prerequisiteId);
    if (command.kind === 'dependency.remove' && !exists) return reject('dependency_not_found', ticket.id, command.prerequisiteId);
    updated = { ...ticket, prerequisites: command.kind === 'dependency.add'
      ? [...ticket.prerequisites, command.prerequisiteId] : ticket.prerequisites.filter(identity => identity !== command.prerequisiteId) };
  }
  return { kind: 'ok', value: { ...state, tickets: state.tickets.map(existing => existing.id === updated.id ? updated : existing) } };
}
