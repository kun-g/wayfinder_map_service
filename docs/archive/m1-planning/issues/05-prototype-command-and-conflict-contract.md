# Prototype the atomic command and conflict contract

Type: prototype
Status: resolved
Blocked by: 01, 02, 03, 04

Historical planning record: resolved means planning complete, not implementation delivered. Current M1 contract: [published specification](../../../spec/m1.md). Later scope corrections supersede early source statements.

## Historical claim

Session: Codex /root
Claim timestamp: 2026-09-17T09:12:48+08:00

This records the completed planning session, not an active reservation.

## Question

What concrete TypeScript command, batch-apply, success, domain-error, and stale-Revision conflict interfaces make every accepted mutation deterministic, atomic, and usable independently of storage or MCP transport?

## Assets

- [TypeScript contract proposal](../prototypes/command-contract.prototype.ts)
- [Interactive atomic command demo](../prototypes/command-contract.prototype.html)
- [Proposal notes and validation stages](../prototypes/command-contract.prototype.md)

These are throwaway primary-source assets for the accepted decision, not production implementation. Local files remain available for review; their captured version is on the independent prototype branch.

## Answer

Accept a small pure domain interface with prepareCreate, prepareApply, and calculateFrontier, plus runtime ID/input decoders. The linked TypeScript contract is the concrete shape reference for the fields and command union; rollback, deletion, full Revision records, and storage operations remain for their existing downstream tickets.

### Preparation and durable commitment

- Creation prepares Revision 1 with null priorRevision. Null denotes Map absence, not a readable Revision 0.
- Preparation never mutates the caller's current state and never claims durable success.
- Apply validates the complete input, checks Map identity and expected Revision, processes commands in listed order on a private working state, validates final graph invariants, rejects no-net-change batches, and prepares one new Revision.
- Per-command existence, lifecycle, claimant, and operation gates are checked in order. Claim acquisition and settlement require satisfied prerequisites at their command's position.
- Cycles, dangling references, settled prerequisites, and claimed prerequisites are checked on the final graph. This permits an explicit atomic reopen batch to list upstream before downstream without implicit cascading.
- Any rejection leaves all commands unapplied. External readers observe no intermediate state.
- The Adapter must atomically compare the stored current Revision with the prepared prior Revision again, then persist state and its immutable Revision together or persist neither. Its compare-and-swap is the authoritative race check.

### Result and error shape

Preparation returns a discriminated prepared, rejected, or conflict result. Prepared includes proposed state, prior Revision, caller-supplied authorship, structured semantic command changes, and derived Frontier. Rejection identifies an input path, command index, or final-state invariant. Conflict identifies the Map, expected Revision, and current Revision so the caller can reread it.

Input, domain rejection, and stale-Revision conflict are data, not exception-driven normal control flow. Runtime decoding does not replace domain invariant checks for typed callers. The Adapter's durable result and full Revision representation are not settled by this ticket.

### Accepted input defaults

- IDs match the complete pattern [A-Za-z0-9][A-Za-z0-9._:-]{0,127}. They are case-sensitive, not normalized, and do not require UUID syntax. Frontier uses ASCII lexical TicketId order.
- Required human text is non-blank and retained without implicit trimming. Notes may be empty. Reopen requires a non-blank reason.
- Extension keys match the complete pattern [a-z][a-z0-9_-]*\.[a-z][a-z0-9_.-]*. Values must be finite, acyclic, plain JSON data; unsupported values are rejected, not coerced.
- Unknown core input fields are rejected. Extension data belongs in extensions. Patch fields replace their supplied value rather than recursively merging it.
- Fog and Scope Exclusion content items have caller-supplied IDs unique across those two sections. Fog graduation may remove an item and create its Ticket in one batch.
- Settlement, outcome, Evidence, and Reference have no separate M1 entity IDs; their containing Ticket and introducing Revision supply the relevant addressing context.
- Empty batches, empty patches, missing edges, repeated claims, and no-net-change batches are rejected without a new Revision. A claim followed by its release in the same batch is a no-net-change rejection; transfer to a different claimant is a real change.
- M1 implements no network retry cache or idempotency-key store. Replaying a committed request with its old expected Revision returns conflict; callers reread and inspect state rather than blindly resubmitting.

### Human-validated display clarification

Destination is a Map property, not a Decision Ticket or Dependency endpoint, and should nevertheless be clearly visible as a Destination anchor in graph projections. Alpha/Beta are presentation labels for work sessions; requests and Claims use distinct opaque ClaimantIds shown separately from those labels. M1 has no independent ClaimId. This clarification does not introduce the production renderer into M1.

### Prototype capture and verification

- Captured branch: codex/prototype-m1-command-contract.
- Immutable capture commit: 52e8f73f378f59fcc9ec87e60b0355e62d4b43ab.
- The branch contains only the three linked prototype assets. No existing project documents were committed, and the main checkout was not switched.
- HTML scripts and stripped TypeScript syntax were checked. This is not a TypeScript type-check.
- Pure logic execution demonstrated claim success, stale-Revision conflict, full batch rejection on claimant mismatch, explicit reopen acceptance, and protection of downstream Claims.
- Browser policy prevented agent-side local-page click validation; the human inspected the local prototype, requested graph and identity-display corrections, and accepted the revised design and remaining defaults.
- Human verdict: accepted on 2026-09-17. No production code was implemented.
