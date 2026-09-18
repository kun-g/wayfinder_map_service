declare const idBrand: unique symbol;
export type Id<K extends string> = string & { readonly [idBrand]: K };
export type MapId = Id<'Map'>;
export type TicketId = Id<'Ticket'>;
export type ClaimantId = Id<'Claimant'>;
export type ContentId = Id<'Content'>;
export type ActorId = Id<'Actor'>;
export type ClientId = Id<'Client'>;
export type RevisionNumber = number;
export type JsonValue = null | boolean | number | string
  | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type Extensions = Readonly<Record<string, JsonValue>>;
export type NonEmpty<T> = readonly [T, ...T[]];
export type Result<T, E> = { readonly kind: 'ok'; readonly value: T }
  | { readonly kind: 'error'; readonly error: E };
export interface InvalidInput {
  readonly code: 'invalid_input';
  readonly path: readonly (string | number)[];
  readonly constraint: string;
}
export type TicketType = 'grilling' | 'prototype' | 'research' | 'task';
export interface Reference { readonly locator: string; readonly label?: string }
export interface Provenance { readonly method: string; readonly sources: readonly Reference[] }
export interface Evidence {
  readonly statement: string;
  readonly references: readonly Reference[];
  readonly provenance?: Provenance;
  readonly extensions: Extensions;
}
export interface Decision { readonly kind: 'decision'; readonly statement: string; readonly rationale: string }
export interface Finding { readonly kind: 'finding'; readonly statement: string; readonly limitations?: string }
export interface Completion {
  readonly kind: 'completion';
  readonly statement: string;
  readonly resultingFacts?: Readonly<Record<string, JsonValue>>;
}
export type OutcomeByType = {
  grilling: Decision; prototype: Decision; research: Finding; task: Completion;
};
export interface Settlement<T extends TicketType> {
  readonly outcome: OutcomeByType[T];
  readonly evidence: readonly Evidence[];
  readonly references: readonly Reference[];
  readonly provenance: Provenance;
  readonly extensions: Extensions;
}
export type StoredSettlement<T extends TicketType> = Settlement<T> & {
  readonly introducedAtRevision: RevisionNumber;
};
export interface TicketBase<T extends TicketType> {
  readonly id: TicketId;
  readonly title: string;
  readonly question: string;
  readonly type: T;
  readonly prerequisites: readonly TicketId[];
  readonly extensions: Extensions;
}
export type StoredTicket = {
  [T in TicketType]: TicketBase<T> & (
    | { readonly status: 'open'; readonly claim: ClaimantId | null }
    | { readonly status: 'settled'; readonly claim: null; readonly settlement: StoredSettlement<T> }
  )
}[TicketType];
export interface MapContent {
  readonly id: ContentId;
  readonly text: string;
  readonly references: readonly Reference[];
}
export interface StoredMapState {
  readonly id: MapId;
  readonly title: string;
  readonly destination: string;
  readonly notes: string;
  readonly fog: readonly MapContent[];
  readonly scopeExclusions: readonly MapContent[];
  readonly tickets: readonly StoredTicket[];
  readonly extensions: Extensions;
  readonly currentRevision: RevisionNumber;
}
export interface MutationAuthor {
  readonly actorId: ActorId;
  readonly clientId: ClientId;
  readonly occurredAt: string;
}
export interface CreateMapInput {
  readonly id: MapId;
  readonly title: string;
  readonly destination: string;
  readonly notes?: string;
  readonly extensions?: Extensions;
  readonly author: MutationAuthor;
}
// Only creation is mintable in this slice. Atomic apply extends this type in issue 2.
export interface SemanticChange {
  readonly commandIndex: number;
  readonly command: 'map.create';
  readonly subjectId: string;
  readonly reason?: string;
}
export interface Revision {
  readonly mapId: MapId;
  readonly revision: RevisionNumber;
  readonly priorRevision: RevisionNumber | null;
  readonly kind: 'create' | 'apply';
  readonly author: MutationAuthor;
  readonly changes: NonEmpty<SemanticChange>;
  readonly state: StoredMapState;
}
export type ReadResult<T> =
  | { readonly kind: 'found'; readonly value: T }
  | { readonly kind: 'not_found'; readonly code: 'map_not_found'; readonly mapId: MapId }
  | { readonly kind: 'not_found'; readonly code: 'revision_not_found'; readonly mapId: MapId; readonly revision: RevisionNumber }
  | { readonly kind: 'rejected'; readonly error: InvalidInput };
export interface Conflict {
  readonly mapId: MapId;
  readonly expectedRevision: RevisionNumber;
  readonly currentRevision: RevisionNumber;
}
export type CommitResult =
  | { readonly kind: 'committed'; readonly revision: Revision; readonly frontier: readonly TicketId[] }
  | { readonly kind: 'conflict'; readonly conflict: Conflict }
  | { readonly kind: 'rejected'; readonly code: 'map_already_exists' | 'map_not_found'; readonly mapId: MapId };
