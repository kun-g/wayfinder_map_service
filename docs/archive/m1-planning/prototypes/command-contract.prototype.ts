/**
 * HISTORICAL THROWAWAY PROTOTYPE — early interface reference, not production code.
 * Bodies, persistence, rollback and deletion are deliberately absent.
 * Later Revision/stored Settlement/Adapter decisions are consolidated in docs/spec/m1.md.
 * Use that published specification for implementation; this capture is incomplete.
 */

declare const idBrand: unique symbol;
export type Id<K extends string> = string & { readonly [idBrand]: K };
export type MapId = Id<"Map">;
export type TicketId = Id<"Ticket">;
export type ClaimantId = Id<"Claimant">;
export type ContentId = Id<"Content">;
export type ActorId = Id<"Actor">;
export type ClientId = Id<"Client">;
export type RevisionNumber = number;
export type JsonValue =
  | null | boolean | number | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };
export type Extensions = Readonly<Record<string, JsonValue>>;
export type NonEmpty<T> = readonly [T, ...T[]];
export type Result<T, E> =
  | { readonly kind: "ok"; readonly value: T }
  | { readonly kind: "error"; readonly error: E };

// Proposed ID rule: 1–128 ASCII characters; case-sensitive; never normalized.
// Grammar: [A-Za-z0-9][A-Za-z0-9._:-]{0,127}; UUIDs are permitted, not required.
export declare function parseId<K extends string>(
  kind: K, input: unknown
): Result<Id<K>, InvalidInput>;

export interface Reference {
  readonly locator: string; // Non-blank opaque source pointer; never fetched.
  readonly label?: string;
}
export interface Provenance {
  readonly method: string; // Non-blank description of how content was produced.
  readonly sources: readonly Reference[];
}
export interface Evidence {
  readonly statement: string;
  readonly references: readonly Reference[];
  readonly provenance?: Provenance; // Required if references are empty.
  readonly extensions: Extensions;
}
export interface Decision {
  readonly kind: "decision";
  readonly statement: string;
  readonly rationale: string;
}
export interface Finding {
  readonly kind: "finding";
  readonly statement: string;
  readonly limitations?: string;
}
export interface Completion {
  readonly kind: "completion";
  readonly statement: string;
  readonly resultingFacts?: Readonly<Record<string, JsonValue>>;
}
export type TicketType = "grilling" | "prototype" | "research" | "task";
type OutcomeByType = {
  grilling: Decision; prototype: Decision;
  research: Finding; task: Completion;
};
export interface Settlement<T extends TicketType> {
  readonly outcome: OutcomeByType[T];
  readonly evidence: readonly Evidence[];
  readonly references: readonly Reference[];
  readonly provenance: Provenance;
  readonly extensions: Extensions;
}
export interface TicketBase<T extends TicketType> {
  readonly id: TicketId;
  readonly title: string;
  readonly question: string;
  readonly type: T;
  readonly prerequisites: readonly TicketId[];
  readonly extensions: Extensions;
}
export type Ticket = {
  [T in TicketType]: TicketBase<T> & (
    | { readonly status: "open"; readonly claim: ClaimantId | null }
    | {
        readonly status: "settled";
        readonly claim: null;
        readonly settlement: Settlement<T>;
      }
  )
}[TicketType];
export interface MapContent {
  readonly id: ContentId;
  readonly text: string;
  readonly references: readonly Reference[];
}
export interface MapState {
  readonly id: MapId;
  readonly title: string;
  readonly destination: string;
  readonly notes: string;
  readonly fog: readonly MapContent[];
  readonly scopeExclusions: readonly MapContent[];
  readonly tickets: readonly Ticket[];
  readonly extensions: Extensions;
  readonly currentRevision: RevisionNumber;
}
export interface MutationAuthor {
  readonly actorId: ActorId;
  readonly clientId: ClientId;
  readonly occurredAt: string; // Caller-supplied UTC RFC3339 timestamp.
}
export interface CreateMapInput {
  readonly id: MapId;
  readonly title: string;
  readonly destination: string;
  readonly notes?: string;
  readonly extensions?: Extensions;
  readonly author: MutationAuthor;
}
export interface TicketInput {
  readonly id: TicketId;
  readonly title: string;
  readonly question: string;
  readonly type: TicketType;
  readonly extensions?: Extensions;
}
type Access = { readonly claimantId?: ClaimantId };
type TicketPatch = Readonly<Partial<
  Pick<TicketInput, "title" | "question" | "type" | "extensions">
>>;
type MapPatch = Readonly<Partial<
  Pick<MapState, "title" | "destination" | "notes" | "extensions">
>>;
type SettleCommand = {
  [T in TicketType]: {
    readonly kind: "ticket.settle";
    readonly ticketId: TicketId;
    readonly ticketType: T;
    readonly claimantId: ClaimantId;
    readonly settlement: Settlement<T>;
  }
}[TicketType];
export type Command =
  | { readonly kind: "map.update"; readonly patch: MapPatch }
  | { readonly kind: "ticket.create"; readonly ticket: TicketInput }
  | ({ readonly kind: "ticket.update"; readonly ticketId: TicketId;
       readonly patch: TicketPatch } & Access)
  | { readonly kind: "ticket.reopen"; readonly ticketId: TicketId;
      readonly reason: string }
  | SettleCommand
  | ({ readonly kind: "dependency.add" | "dependency.remove";
       readonly dependentId: TicketId; readonly prerequisiteId: TicketId } & Access)
  | { readonly kind: "claim.acquire" | "claim.release";
      readonly ticketId: TicketId; readonly claimantId: ClaimantId }
  | { readonly kind: "claim.clear"; readonly ticketId: TicketId;
      readonly expectedClaimantId: ClaimantId; readonly reason: string }
  | { readonly kind: "content.add"; readonly section: "fog" | "scopeExclusions";
      readonly item: MapContent }
  | { readonly kind: "content.update"; readonly section: "fog" | "scopeExclusions";
      readonly item: MapContent }
  | { readonly kind: "content.remove"; readonly section: "fog" | "scopeExclusions";
      readonly itemId: ContentId };

export interface ApplyRequest {
  readonly mapId: MapId;
  readonly expectedRevision: RevisionNumber;
  readonly author: MutationAuthor;
  readonly commands: NonEmpty<Command>;
}
export interface InvalidInput {
  readonly code: "invalid_input";
  readonly path: readonly (string | number)[];
  readonly constraint: string;
}
export type CommandErrorCode =
  | "ticket_not_found" | "ticket_already_exists"
  | "ticket_not_open" | "ticket_not_settled"
  | "ticket_already_claimed" | "claim_required" | "claim_mismatch"
  | "claim_not_found" | "unsettled_dependency"
  | "dependency_already_exists" | "dependency_not_found" | "self_dependency"
  | "settlement_type_mismatch"
  | "content_already_exists" | "content_not_found";
export type InvariantErrorCode =
  | "dependency_cycle" | "dangling_dependency"
  | "settled_ticket_has_open_prerequisite"
  | "claimed_ticket_has_open_prerequisite";
export type Rejection =
  | {
      readonly stage: "input"; readonly error: InvalidInput;
    }
  | {
      readonly stage: "command"; readonly commandIndex: number;
      readonly code: CommandErrorCode;
      readonly ticketIds: readonly TicketId[];
    }
  | {
      readonly stage: "final_state"; readonly code: InvariantErrorCode;
      readonly ticketIds: readonly TicketId[];
    }
  | { readonly stage: "final_state"; readonly code: "no_changes" };
export interface Conflict {
  readonly mapId: MapId;
  readonly expectedRevision: RevisionNumber;
  readonly currentRevision: RevisionNumber;
  // Caller rereads this Map; no automatic merge, rebase, or blind retry.
}
export interface Change {
  readonly commandIndex: number;
  readonly command: Command["kind"] | "map.create";
  readonly subjectId: string;
}
export interface PreparedChange {
  readonly mapId: MapId;
  readonly priorRevision: RevisionNumber | null; // null only for Map creation.
  readonly next: MapState;
  readonly author: MutationAuthor;
  readonly changes: NonEmpty<Change>; // Structured semantic summary, not transcript.
}
export type PrepareResult =
  | { readonly kind: "prepared"; readonly change: PreparedChange;
      readonly frontier: readonly TicketId[] }
  | { readonly kind: "rejected"; readonly rejection: Rejection }
  | { readonly kind: "conflict"; readonly conflict: Conflict };

// Raw runtime input is validated before executing any command.
export declare function decodeApplyRequest(
  raw: unknown
): Result<ApplyRequest, InvalidInput>;
export declare function prepareCreate(
  input: CreateMapInput
): Result<PreparedChange, InvalidInput>;
export declare function prepareApply(
  current: MapState, request: ApplyRequest
): PrepareResult;
export declare function calculateFrontier(
  current: MapState
): readonly TicketId[];

// Later Adapter contract consumes PreparedChange and atomically:
// 1. checks stored currentRevision == priorRevision (or absence when null);
// 2. writes next plus its immutable Revision record, or writes neither.
// "prepared" DOES NOT mean committed; pure preparation alone cannot prevent races.
// Rollback, deletion, full Revision records and storage methods are later tickets.
