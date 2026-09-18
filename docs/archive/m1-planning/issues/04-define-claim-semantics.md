# Define Claim semantics

Type: grilling
Status: resolved
Blocked by: 02

Historical planning record: resolved means planning complete, not implementation delivered. Current M1 contract: [published specification](../../../spec/m1.md). Later scope corrections supersede early source statements.

## Historical claim

Session: Codex /root
Claim timestamp: 2026-09-17T08:23:44+08:00

This records the completed planning session, not an active reservation.

## Question

What identity and state does an M1 Claim contain, which claim and release transitions are valid, and what relationship—if any—must exist between a Claim actor and the actor who settles the Decision Ticket?

## Answer

### Purpose and identity

Claim is a domain-enforced coordination reservation, not authentication or authorization. It prevents another work session from taking over a Ticket after merely rereading the latest Revision.

A Claim contains only a caller-supplied opaque `ClaimantId` identifying a distinct work session. It is not an OwnerId, authenticated actor, or client identity. Independent concurrent work sessions use different IDs; continuation of the same logical work session preserves its ID. Clients generate and retain the identity rather than asking the human to enter it manually. One claimant may hold several Claims: M1 implements no per-claimant quota, rather than implementing a separate “multiple Claims” feature.

ID validity has separate responsibilities:

- Runtime construction and domain entry validation check the permitted portable ID shape. TypeScript branding alone is insufficient. Exact constraints remain for **Prototype the atomic command and conflict contract**.
- Callers generate distinct work-session IDs, for example random UUIDs, and avoid sharing them between independent sessions. M1 has no session registry and cannot prove that a supplied identity denotes a unique or authentic session.
- The domain checks Ticket eligibility; the Adapter's expected-Revision check prevents concurrent writes from both succeeding. MapId and TicketId duplication are checked by their respective storage and Aggregate boundaries.

Claim creation time is available from the introducing Revision. Claim has no duplicate timestamp, independent Claim ID, lease, heartbeat, expiry, or automatic takeover behavior in M1.

### Normal transitions and gates

- Claim creation requires a Ticket currently in Frontier: open, unclaimed, and with every prerequisite settled.
- Each Ticket has at most one Claim. Repeated claiming, even by the same claimant, returns `ticket_already_claimed` and creates no Revision. Network-retry idempotency remains for the interface contract.
- Editing a claimed Ticket, including its descriptive fields, extensions, and Dependencies, requires a matching claimant. An unclaimed open Ticket may be edited without first claiming it.
- Settlement requires a current Claim and the matching claimant. Successful settlement atomically removes the Claim. The Revision actor may differ from the claimant; the actor describes authorship while the claimant identifies the reserved work session.
- Normal release requires a matching claimant. Missing Claims and mismatches return explicit errors. Release causes Frontier eligibility to be recomputed.
- Every accepted Claim creation, release, or manual clear is a revisioned state change subject to expected-Revision validation.

### Dependencies and interruption

A committed Claim may exist only on an open Ticket whose prerequisites are all settled. An operation that would block a claimed Ticket is rejected unless the atomic batch explicitly releases or clears the affected Claim. There is no silent Claim removal.

M1 includes explicit human-directed `clearClaim` for abandoned work. It requires the current `expectedClaimantId`, the expected Revision, and a non-empty reason, and records a new Revision. It does not require the old work session to remain available. M1 does not implement administrator permissions, automatic stale detection, or automatic recovery policy; a future service layer controls access to this deliberate override.

There is no dedicated transfer command. Transfer is expressed as an atomic release followed by a new claim, using manual clear instead of normal release when the original session is unavailable. Each operation still follows its explicit identity and state checks.

### Evidence

- [Define the Decision Ticket lifecycle and settlement model](02-define-decision-ticket-lifecycle.md): Claim is orthogonal to open/settled state, and reopening clears Claim.
- [Define Dependency and Frontier invariants](03-define-dependency-and-frontier-invariants.md): Frontier excludes claimed Tickets and is derived from current state.
- Confirmed after three Grilling rounds, clarification of ID responsibilities and the absence of a per-session quota, and the convergence checkpoint on 2026-09-17.
