// Shared real-tool fixtures; these are command inputs and expected public
// results, not another implementation of the domain rules.
const claimantId = 'matrix:owner';
const ticket = (id: string) => ({ kind: 'ticket.create', ticket: { id, title: id, question: 'Ready?', type: 'task' } });
const acquire = (ticketId: string) => ({ kind: 'claim.acquire', ticketId, claimantId });
const settle = (ticketId: string, ticketType = 'task') => ({ kind: 'ticket.settle', ticketId, ticketType, claimantId, settlement: {
  outcome: ticketType === 'research' ? { kind: 'finding', statement: 'Observed' } : { kind: 'completion', statement: 'Finished' },
  evidence: [], references: [{ locator: 'fixture:matrix' }], provenance: { method: 'Acceptance fixture', sources: [] }, extensions: {},
} });
export const rejectionSeed = [
  ...['Open', 'Claimed', 'Blocked', 'Settled', 'Downstream', 'EligibleDependent'].map(ticket),
  acquire('Claimed'), acquire('Settled'), settle('Settled'),
  { kind: 'dependency.add', dependentId: 'Blocked', prerequisiteId: 'Open' },
  { kind: 'dependency.add', dependentId: 'Downstream', prerequisiteId: 'Settled' }, acquire('Downstream'), settle('Downstream'),
  { kind: 'dependency.add', dependentId: 'EligibleDependent', prerequisiteId: 'Settled' }, acquire('EligibleDependent'),
  { kind: 'content.add', section: 'fog', item: { id: 'F', text: 'Fog', references: [] } },
  { kind: 'content.add', section: 'scopeExclusions', item: { id: 'S', text: 'Excluded', references: [] } },
];
interface Scenario { readonly label: string; readonly commands: unknown[]; readonly rejection: Record<string, unknown> }
const command = (label: string, commands: unknown[], code: string, ticketIds: string[] = [], commandIndex = 0): Scenario =>
  ({ label, commands, rejection: { stage: 'command', commandIndex, code, ticketIds } });
export const rejectionCases: readonly Scenario[] = [
  command('duplicate ticket', [ticket('Open')], 'ticket_already_exists', ['Open']),
  command('missing ticket', [{ kind: 'ticket.update', ticketId: 'Missing', patch: { title: 'Changed' } }], 'ticket_not_found', ['Missing']),
  ...['ticket.update', 'claim.acquire', 'claim.release', 'claim.clear', 'ticket.settle', 'dependency.add', 'dependency.remove'].map(kind => {
    const input = kind === 'ticket.update' ? { kind, ticketId: 'Settled', patch: { title: 'Changed' } }
      : kind === 'ticket.settle' ? settle('Settled') : kind.startsWith('dependency.') ? { kind, dependentId: 'Settled', prerequisiteId: 'Open' }
        : kind === 'claim.clear' ? { kind, ticketId: 'Settled', expectedClaimantId: claimantId, reason: 'Clear' } : { kind, ticketId: 'Settled', claimantId };
    return command(`settled ${kind}`, [input], 'ticket_not_open', ['Settled']);
  }),
  command('settlement needs Claim', [settle('Open')], 'claim_required', ['Open']),
  command('claimed edit needs Claimant', [{ kind: 'ticket.update', ticketId: 'Claimed', patch: { title: 'Changed' } }], 'claim_required', ['Claimed']),
  command('wrong settlement Claimant', [{ ...settle('Claimed'), claimantId: 'matrix:other' }], 'claim_mismatch', ['Claimed']),
  command('wrong release Claimant', [{ kind: 'claim.release', ticketId: 'Claimed', claimantId: 'matrix:other' }], 'claim_mismatch', ['Claimed']),
  command('wrong clear Claimant', [{ kind: 'claim.clear', ticketId: 'Claimed', expectedClaimantId: 'matrix:other', reason: 'Clear' }], 'claim_mismatch', ['Claimed']),
  command('wrong edit Claimant', [{ kind: 'ticket.update', ticketId: 'Claimed', claimantId: 'matrix:other', patch: { title: 'Changed' } }], 'claim_mismatch', ['Claimed']),
  ...[claimantId, 'matrix:other'].map(value => command(`repeated acquisition ${value}`, [{ ...acquire('Claimed'), claimantId: value }], 'ticket_already_claimed', ['Claimed'])),
  command('blocked acquisition', [acquire('Blocked')], 'unsettled_dependency', ['Blocked']),
  command('settle before restored prerequisite', [{ kind: 'ticket.reopen', ticketId: 'Settled', reason: 'Revisit' }, settle('EligibleDependent')], 'unsettled_dependency', ['EligibleDependent'], 1),
  command('release absent Claim', [{ kind: 'claim.release', ticketId: 'Open', claimantId }], 'claim_not_found', ['Open']),
  command('clear absent Claim', [{ kind: 'claim.clear', ticketId: 'Open', expectedClaimantId: claimantId, reason: 'Clear' }], 'claim_not_found', ['Open']),
  command('actual type mismatch', [settle('Claimed', 'research')], 'settlement_type_mismatch', ['Claimed']),
  command('reopen open', [{ kind: 'ticket.reopen', ticketId: 'Open', reason: 'Revisit' }], 'ticket_not_settled', ['Open']),
  command('self dependency', [{ kind: 'dependency.add', dependentId: 'Open', prerequisiteId: 'Open' }], 'self_dependency', ['Open']),
  command('duplicate dependency', [{ kind: 'dependency.add', dependentId: 'Blocked', prerequisiteId: 'Open' }], 'dependency_already_exists', ['Blocked', 'Open']),
  command('missing dependency', [{ kind: 'dependency.remove', dependentId: 'Open', prerequisiteId: 'Blocked' }], 'dependency_not_found', ['Open', 'Blocked']),
  command('missing prerequisite', [{ kind: 'dependency.add', dependentId: 'Open', prerequisiteId: 'Missing' }], 'ticket_not_found', ['Missing']),
  ...(['fog', 'scopeExclusions'] as const).flatMap(section => [
    command(`duplicate ${section} content across sections`, [{ kind: 'content.add', section, item: { id: section === 'fog' ? 'S' : 'F', text: 'Duplicate', references: [] } }], 'content_already_exists'),
    command(`missing ${section} content update`, [{ kind: 'content.update', section, item: { id: 'Missing', text: 'Missing', references: [] } }], 'content_not_found'),
    command(`wrong section ${section} removal`, [{ kind: 'content.remove', section, itemId: section === 'fog' ? 'S' : 'F' }], 'content_not_found'),
  ]),
  { label: 'cycle', commands: [{ kind: 'dependency.add', dependentId: 'Open', prerequisiteId: 'Blocked' }], rejection: { stage: 'final_state', code: 'dependency_cycle', ticketIds: ['Blocked', 'Open'] } },
  { label: 'settled downstream after reopen', commands: [{ kind: 'ticket.reopen', ticketId: 'Settled', reason: 'Incomplete revisit' }], rejection: { stage: 'final_state', code: 'settled_ticket_has_open_prerequisite', ticketIds: ['Downstream', 'Settled'] } },
  { label: 'claimed dependent after complete reopen', commands: [{ kind: 'ticket.reopen', ticketId: 'Settled', reason: 'Revisit' }, { kind: 'ticket.reopen', ticketId: 'Downstream', reason: 'Revisit' }], rejection: { stage: 'final_state', code: 'claimed_ticket_has_open_prerequisite', ticketIds: ['EligibleDependent', 'Settled'] } },
  { label: 'net no-op', commands: [{ kind: 'claim.acquire', ticketId: 'Open', claimantId }, { kind: 'claim.release', ticketId: 'Open', claimantId }], rejection: { stage: 'final_state', code: 'no_changes' } },
];
