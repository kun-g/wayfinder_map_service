/** THROWAWAY ACCEPTED INTERFACE REFERENCE. Not a production Adapter.
 * Corrected after clarification on 2026-09-17: independently stored Maps,
 * one Map per request, three asynchronous operations, atomic state/history publication.
 * The earlier Git capture's single-Map-instance restriction is superseded.
 */
import type {
  MapId, TicketId, TicketType, TicketBase, Settlement, MapState,
  MutationAuthor, RevisionNumber, Change, NonEmpty, Conflict, InvalidInput,
} from "./command-contract.prototype.js";

export type StoredSettlement<T extends TicketType> = Settlement<T> & {
  readonly introducedAtRevision: RevisionNumber;
};
export type StoredTicket = {
  [T in TicketType]: TicketBase<T> & (
    | { readonly status: "open"; readonly claim: import("./command-contract.prototype.js").ClaimantId | null }
    | { readonly status: "settled"; readonly claim: null;
        readonly settlement: StoredSettlement<T> }
  )
}[TicketType];
export type StoredMapState = Omit<MapState, "tickets"> & {
  readonly tickets: readonly StoredTicket[];
};
export type SemanticChange = Change & {
  /** Preserve a required reopen/clear reason in that command's summary. */
  readonly reason?: string;
};
export interface Revision {
  readonly mapId: MapId;
  readonly revision: RevisionNumber;
  readonly priorRevision: RevisionNumber | null;
  readonly kind: "create" | "apply";
  readonly author: MutationAuthor;
  readonly changes: NonEmpty<SemanticChange>;
  readonly state: StoredMapState;
}

// Internal opaque value minted by the domain preparation module.
// This brand is not authentication or a network deserialization mechanism.
declare const preparedBrand: unique symbol;
interface PreparedBase {
  readonly [preparedBrand]: true;
  readonly mapId: MapId;
  readonly next: StoredMapState;
  readonly author: MutationAuthor;
  readonly changes: NonEmpty<SemanticChange>;
}
export type PreparedCommit = PreparedBase & (
  | { readonly kind: "create"; readonly priorRevision: null }
  | { readonly kind: "apply"; readonly priorRevision: RevisionNumber }
);

export type ReadResult<T> =
  | { readonly kind: "found"; readonly value: T }
  | { readonly kind: "not_found"; readonly code: "map_not_found"; readonly mapId: MapId }
  | { readonly kind: "not_found"; readonly code: "revision_not_found";
      readonly mapId: MapId; readonly revision: RevisionNumber }
  | { readonly kind: "rejected"; readonly error: InvalidInput };

export type CommitResult =
  | { readonly kind: "committed"; readonly revision: Revision;
      readonly frontier: readonly TicketId[] }
  | { readonly kind: "conflict"; readonly conflict: Conflict }
  | { readonly kind: "rejected"; readonly code: "map_already_exists" | "map_not_found";
      readonly mapId: MapId };

export interface StateAdapter {
  readCurrent(mapId: MapId): Promise<ReadResult<StoredMapState>>;
  readRevision(mapId: MapId, revision: RevisionNumber): Promise<ReadResult<Revision>>;
  commit(prepared: PreparedCommit): Promise<CommitResult>;
}

/** Accepted behavioral interface, not just signatures:
 * - A fresh memory Adapter is empty. It can store different MapIds with isolated
 *   state/history and per-Map Revision sequences. Same-ID creation yields
 *   map_already_exists; different-ID creation does not affect existing Maps.
 * - Each request/commit concerns exactly one Map. No cross-Map batch or atomic
 *   transaction is exposed. Missing-ID reads/apply commits yield map_not_found.
 * - Separate instances are independent; no persistence or restart loading occurs.
 * - Revision numbers are positive safe integers; invalid read numbers are input
 *   rejections, valid missing numbers are not_found. Overflow is rejected by pure
 *   preparation, with defensive envelope checks at commit, never wrapped/reset.
 * - Every successful commit publishes state plus its immutable Revision at once.
 * - Create CAS tests absence; apply CAS tests exact stored priorRevision.
 * - Each read/commit result is detached from stored data. Prepared input is captured
 *   before asynchronous work so later caller mutation cannot change the write.
 * - Each individual operation is atomic. Multiple separate reads are not one
 *   transaction; callers pin a known Revision when they need a stable historical view.
 * - No raw command dispatch, SQL transaction handles, list/search, rollback, deletion,
 *   retry cache, or automatic conflict resolution is exposed by this M1 port.
 * - Unexpected infrastructure/programming failures reject the Promise. They are
 *   not domain rejections or stale conflicts. The M1 memory Adapter must publish
 *   neither state nor Revision when its local pre-publication write fails.
 * - PreparedCommit is internal trusted output, not caller-editable external JSON.
 *   The final specification must reconcile this with earlier PreparedChange and
 *   distinguish Settlement input from StoredSettlement.
 */
