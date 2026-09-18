import type {
  ActorId, ApplyRequest, ClaimantId, ClientId, ContentId, CreateMapInput, MapId, PreparedCommit,
  Command, MapContent, Settlement, SettleCommand, StateAdapter, StoredTicket, TicketId, TicketInput, TicketPatch,
} from '../../src/index.js';
// @ts-expect-error Array-shape validation is internal, not another public seam.
import { validateArrayShape } from '../../src/index.js';
// @ts-expect-error Settlement validation is internal, not another public operation.
import { validateSettlement } from '../../src/index.js';
// @ts-expect-error Plain JSON validation is internal, not an import/validation port.
import { validateJsonObject } from '../../src/index.js';

// Type-only fixture, checked by tsc; deliberately never executed by Vitest.
export function publicContract(
  mapId: MapId, ticketId: TicketId, claimantId: ClaimantId, contentId: ContentId,
  actorId: ActorId, clientId: ClientId, create: CreateMapInput, adapter: StateAdapter,
  ticket: StoredTicket,
) {
  // @ts-expect-error ID brands are not interchangeable.
  const wrongMap: MapId = ticketId;
  // @ts-expect-error Session identity is not actor identity.
  const wrongActor: ActorId = claimantId;
  // @ts-expect-error Client identity is not actor identity.
  const wrongClient: ClientId = actorId;
  // @ts-expect-error Content identity is not Ticket identity.
  const wrongTicket: TicketId = contentId;
  // @ts-expect-error A string is not a validated MapId.
  const raw: MapId = 'Alpha';
  // @ts-expect-error The internal brand cannot be provided by ordinary callers.
  const fabricated: PreparedCommit = {
    kind: 'create', priorRevision: null, mapId, author: create.author,
    changes: [{ commandIndex: 0, command: 'map.create', subjectId: mapId }],
    next: { id: mapId, title: 'Alpha', destination: 'Arrive', notes: '',
      fog: [], scopeExclusions: [], tickets: [], extensions: {}, currentRevision: 1 },
  };
  // @ts-expect-error Create input is not prepared storage state or JSON import.
  adapter.commit(create);
  // @ts-expect-error StateAdapter has no import port.
  adapter.importState({});
  // @ts-expect-error StateAdapter has no public failure/test port.
  adapter.failNextCommit();
  // @ts-expect-error Typed requests require a nonempty command tuple.
  const empty: ApplyRequest = { mapId, expectedRevision: 1, author: create.author, commands: [] };
  const rawJson: unknown = {};
  // @ts-expect-error Unknown JSON is not an opaque prepared value.
  adapter.commit(rawJson);
  const createTicket: TicketInput = { id: ticketId, title: 'Title', question: 'Question', type: 'task' };
  // @ts-expect-error A MapId cannot identify a Ticket.
  const badTicket: TicketInput = { ...createTicket, id: mapId };
  // @ts-expect-error TicketInput cannot import stored prerequisites.
  const importTicket: TicketInput = { ...createTicket, prerequisites: [] };
  // @ts-expect-error Ticket identity cannot be changed in a patch.
  const changeIdentity: TicketPatch = { id: ticketId };
  // @ts-expect-error Ticket status is not caller-editable.
  const changeStatus: TicketPatch = { status: 'settled' };
  // @ts-expect-error Access uses ClaimantId, not ActorId.
  const wrongAccess: Command = { kind: 'ticket.update', ticketId, patch: { title: 'Next' }, claimantId: actorId };
  const acquire: Command = { kind: 'claim.acquire', ticketId, claimantId };
  const release: Command = { kind: 'claim.release', ticketId, claimantId };
  const clear: Command = { kind: 'claim.clear', ticketId, expectedClaimantId: claimantId, reason: 'Manual override' };
  // @ts-expect-error ClaimantId identifies a session, not an actor.
  const actorClaim: Command = { kind: 'claim.acquire', ticketId, claimantId: actorId };
  // @ts-expect-error Client identity cannot release a session Claim.
  const clientRelease: Command = { kind: 'claim.release', ticketId, claimantId: clientId };
  // @ts-expect-error Clear requires the expected ClaimantId, not Access claimantId.
  const wrongClear: Command = { kind: 'claim.clear', ticketId, claimantId, reason: 'Manual override' };
  // @ts-expect-error Clear requires a reason.
  const unexplainedClear: Command = { kind: 'claim.clear', ticketId, expectedClaimantId: claimantId };
  // @ts-expect-error Claims have no independent M1 entity ID.
  const independentClaim: Command = { kind: 'claim.acquire', ticketId, claimantId, claimId: 'claim:1' };
  // @ts-expect-error Claims have no lease/expiry mechanism.
  const expiringClaim: Command = { kind: 'claim.acquire', ticketId, claimantId, expiresAt: '2026-09-19T00:00:00Z' };
  // @ts-expect-error Ticket/Map brands are not interchangeable for Claim targets.
  const wrongClaimTarget: Command = { kind: 'claim.release', ticketId: mapId, claimantId };
  // @ts-expect-error Dependencies use TicketId endpoints, never cross-Map IDs.
  const wrongEndpoint: Command = { kind: 'dependency.add', dependentId: ticketId, prerequisiteId: mapId };
  // @ts-expect-error MapContent requires a ContentId, not TicketId.
  const wrongContent: MapContent = { id: ticketId, text: 'Text', references: [] };
  // @ts-expect-error Content edits accept exactly the two defined sections.
  const wrongSection: Command = { kind: 'content.add', section: 'Fog', item: { id: contentId, text: 'Text', references: [] } };
  // @ts-expect-error Content removal cannot identify a Ticket for deletion.
  const removeTicket: Command = { kind: 'content.remove', section: 'fog', itemId: ticketId };
  // @ts-expect-error Reference labels are optional strings, not arbitrary JSON.
  const wrongReference: MapContent = { id: contentId, text: 'Text', references: [{ locator: 'source', label: 1 }] };
  const research: Settlement<'research'> = {
    outcome: { kind: 'finding', statement: 'Found' }, evidence: [], references: [],
    provenance: { method: 'inspect', sources: [] }, extensions: {},
    // @ts-expect-error Introduction metadata is not caller Settlement input.
    introducedAtRevision: 1,
  };
  const task: Settlement<'task'> = {
    // @ts-expect-error Outcomes are correlated to Ticket type.
    outcome: { kind: 'decision', statement: 'Choose', rationale: 'Because' },
    evidence: [], references: [], provenance: { method: 'do', sources: [] }, extensions: {},
  };
  const accepted: Settlement<'task'> = { outcome: { kind: 'completion', statement: 'Done' }, evidence: [], references: [],
    provenance: { method: 'inspect', sources: [] }, extensions: {} };
  const settle: SettleCommand = { kind: 'ticket.settle', ticketId, ticketType: 'task', claimantId, settlement: accepted };
  const reopen: Command = { kind: 'ticket.reopen', ticketId, reason: 'Reconsider' };
  // @ts-expect-error Command Ticket type and outcome remain correlated.
  const wrongOutcome: SettleCommand = { kind: 'ticket.settle', ticketId, ticketType: 'research', claimantId, settlement: accepted };
  // @ts-expect-error ActorId is not a ClaimantId for settlement access.
  const wrongSettler: SettleCommand = { kind: 'ticket.settle', ticketId, ticketType: 'task', claimantId: actorId, settlement: accepted };
  // @ts-expect-error Settlement introduction metadata is derived by preparation.
  const importIntroduction: SettleCommand = { kind: 'ticket.settle', ticketId, ticketType: 'task', claimantId, settlement: { ...accepted, introducedAtRevision: 1 } };
  // @ts-expect-error Reopen requires a reason.
  const unexplainedReopen: Command = { kind: 'ticket.reopen', ticketId };
  // @ts-expect-error Reopen cannot install an arbitrary Settlement.
  const importReopen: Command = { kind: 'ticket.reopen', ticketId, reason: 'Reconsider', settlement: accepted };
  // @ts-expect-error Completion resultingFacts is a plain record, not an array.
  const arrayFacts: Settlement<'task'> = { ...accepted, outcome: { kind: 'completion', statement: 'Done', resultingFacts: [] } };
  const narrowing = (command: SettleCommand) => {
    if (command.ticketType === 'research') {
      const finding: 'finding' = command.settlement.outcome.kind;
      // @ts-expect-error Finding is not a Decision and has no rationale.
      command.settlement.outcome.rationale;
      void finding;
    } else if (command.ticketType === 'task') {
      const completion: 'completion' = command.settlement.outcome.kind;
      void completion;
    } else {
      const decision: 'decision' = command.settlement.outcome.kind;
      const rationale: string = command.settlement.outcome.rationale;
      void [decision, rationale];
    }
  };
  if (ticket.status === 'open') {
    const session: ClaimantId | null = ticket.claim;
    // @ts-expect-error Open Tickets contain no accepted Settlement.
    ticket.settlement;
    void session;
  } else {
    const noClaim: null = ticket.claim;
    const introduction: number = ticket.settlement.introducedAtRevision;
    if (ticket.type === 'research') {
      const finding: 'finding' = ticket.settlement.outcome.kind;
      void finding;
    }
    void [noClaim, introduction];
  }
  void [clientId, wrongMap, wrongActor, wrongClient, wrongTicket, raw, fabricated, empty, research, task,
    badTicket, importTicket, changeIdentity, changeStatus, wrongAccess, wrongEndpoint,
    wrongContent, wrongSection, removeTicket, wrongReference, validateArrayShape,
    acquire, release, clear, actorClaim, clientRelease, wrongClear, unexplainedClear,
    independentClaim, expiringClaim, wrongClaimTarget, accepted, settle, reopen, wrongOutcome, wrongSettler,
    importIntroduction, unexplainedReopen, importReopen, arrayFacts, narrowing, validateSettlement, validateJsonObject];
}
