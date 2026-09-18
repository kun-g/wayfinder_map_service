# Atomic command contract — historical throwaway reference

Status: historical proposal accepted through planning and consolidated into the [published M1 specification](../../../spec/m1.md). The captured interface omits later stored Settlement/Revision reconciliation; use the specification for implementation.

Question: can a small pure preparation interface express the settled Map behavior while keeping durable commit, conflicts, and final graph validation understandable?

Assets: the sibling TypeScript file describes the proposed contract; the sibling HTML file is a self-contained, simplified behavioral demo. Neither is production implementation.

## Proposed entry points

- prepareCreate constructs Revision 1 state with null priorRevision; the Adapter must reject an existing MapId. Null denotes absence, not a readable Revision 0.
- prepareApply validates a request, applies its ordered commands to a private working copy, validates the final graph, and prepares exactly one new Revision.
- calculateFrontier derives a canonical list. Runtime decoders validate untrusted input; typed callers are not exempt from domain checks.
- The Adapter must perform a final atomic expected-Revision check and persist state and Revision together. Preparation is not durable success.

## Proposed validation order

1. Validate the complete input shape, including every command payload.
2. Check Map identity and expected Revision against the supplied current state.
3. Process commands in listed order. Existence, lifecycle, claimant and operation-specific gates apply at each step.
4. Validate final graph invariants: cycles, missing endpoints, settled prerequisites and claimed prerequisites.
5. Reject a batch with no net state change; otherwise increment currentRevision once.
6. At durable commit, perform authoritative compare-and-swap again.

Graph invariants are final-state checks so an atomic explicit reopen batch may reopen the upstream first. Per-command guards are not deferred: claim acquisition and settlement still require satisfied prerequisites at that command's position. Earlier rejected commands never publish any change.

## Proposals accepted during the original planning session

- IDs use 1–128 ASCII characters, start with an alphanumeric, and then allow alphanumerics, dot, underscore, colon and hyphen. IDs are case-sensitive and are not trimmed or rewritten. UUIDs are examples, not a required schema. Frontier uses ASCII lexical comparison.
- Non-blank human text is preserved without implicit trimming. Notes may be empty. Extension keys match the complete pattern [a-z][a-z0-9_-]*\.[a-z][a-z0-9_.-]*, and values are finite, acyclic, plain JSON values; unsupported values are rejected rather than silently coerced.
- Content items in Fog and Scope Exclusions have IDs unique across those two sections. A batch can remove a Fog item and create its newly precise Ticket atomically.
- Settlement, outcome, Evidence and Reference have no separate M1 IDs. Their containing Ticket and introducing Revision provide addressing; current aggregate timestamps and duplicated authorship remain absent.
- Unknown core input fields are rejected; extensibility goes through extensions. Patch fields replace the supplied value rather than applying an implicit recursive merge.
- Empty batches, empty patches, missing edges, repeated claim acquisition and no-net-change batches are rejected without a new Revision.
- Successful preparation returns the proposed current state, structured semantic changes and Frontier. Rejection points to an input path, command index, or final-state invariant. Conflict gives Map identity and current Revision for rereading.
- M1 has no network retry cache or idempotency-key store. Repeating a committed write with its old expectedRevision returns conflict. The caller rereads and checks the observed state, rather than blindly applying the request again.
- Reopen requires a non-blank semantic reason. Artificial claim-and-release in one batch is a no-net-change rejection; work-session transfer to a different claimant is a real change.

## Deliberately deferred

At construction time, full Revision representation, semantic summaries and historical reads were left to downstream M1 planning Tickets. Those decisions are now complete and included in the published M1 contract. Rollback restoration and Ticket/Map deletion remain separate deferred post-M1 planning efforts.

## Walkthrough coverage

- Claim then settle: a dependent enters Frontier.
- A valid first command followed by a claimant mismatch: the complete batch is rejected.
- A second writer supplies an old Revision: conflict, with no state mutation.
- Reopen upstream alone versus explicitly reopening both upstream and downstream.
- Reopen a prerequisite of a claimed Ticket versus an explicit claim clear in the same batch.
- Cyclic Dependencies: final graph rejection.

The HTML demo uses only two Grilling Tickets and simplified Decision content. IDs, JSON shape validation, content editing and persistence are specified in the draft, not fully implemented by the demo.

## Display clarification after human feedback

The demo now shows an actual Dependency graph plus a visually distinct Destination anchor. Destination remains a Map property, not a Decision Ticket or a Dependency endpoint. Ticket arrows run from prerequisite to dependent; a visual Destination anchor does not imply an automatic Map completion transition.

Alpha and Beta are display labels for work sessions. Their supplied ClaimantIds are session-alpha-7f3a and session-beta-9c21, and both labels and raw IDs are shown. The domain currently has no independent ClaimId: a Claim records the identity holding the reservation, not a separately identified reservation entity. Adding such an entity ID would be a new decision, not a display correction.
