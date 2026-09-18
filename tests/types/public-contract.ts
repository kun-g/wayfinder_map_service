import type {
  ActorId, ApplyRequest, ClaimantId, ClientId, ContentId, CreateMapInput, MapId, PreparedCommit,
  Settlement, StateAdapter, StoredTicket, TicketId,
} from '../../src/index.js';

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
  void [clientId, wrongMap, wrongActor, wrongClient, wrongTicket, raw, fabricated, empty, research, task];
}
