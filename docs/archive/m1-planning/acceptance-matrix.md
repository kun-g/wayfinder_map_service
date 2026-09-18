# M1 acceptance matrix

Status: accepted by consolidated human confirmation on 2026-09-17. This inventory derives from settled contracts; it does not add domain behavior. The controlling acceptance decision remains [Define the executable M1 acceptance contract](issues/09-define-acceptance-contract.md). No tests or production implementation are generated in this planning effort.

Record role: historical accepted planning handoff. The [published M1 contract](../../spec/m1.md) is the implementation entry point; this source is retained for provenance rather than maintained in parallel.

## Mandatory scenario families

| Family | Observable checks | Controlling contract |
| --- | --- | --- |
| Creation | Valid creation publishes Revision 1 with exactly one nonblank Destination; invalid creation publishes nothing. | [Map aggregate](issues/01-define-map-aggregate-boundary.md) |
| Runtime input | ID grammar and case preservation, nonblank text, permitted empty notes, unknown core fields, namespaced plain finite JSON extensions, replacement rather than recursive merge. | [Atomic commands](issues/05-prototype-command-and-conflict-contract.md) |
| Ticket lifecycle | Creation and open edits; settled immutability; explicit reasoned reopen; type-correct settlements and research Evidence/Reference requirements. | [Lifecycle](issues/02-define-decision-ticket-lifecycle.md) |
| Dependencies | Same-Map AND prerequisites; missing, duplicate, self, and cyclic edges; open-dependent edit restrictions; explicit reopening of affected settled downstream tickets. | [Dependency invariants](issues/03-define-dependency-and-frontier-invariants.md) |
| Claims | Frontier-only acquisition; repeated acquisition rejection; matched editing, release, and settlement; reasoned manual clear; explicit transfer; one claimant may hold multiple tickets; actor is not claimant identity. | [Claims](issues/04-define-claim-semantics.md) |
| Frontier | Exact eligible set, including empty graphs and empty prerequisites; claimed/settled/blocked tickets excluded; ASCII lexical TicketId ordering; enumerate 0–4-Ticket dependency graphs and legal status/Claim combinations with an independent oracle. Reject cyclic graphs separately. | [Frontier](issues/03-define-dependency-and-frontier-invariants.md) |
| Atomic batches | Whole-input validation, ordered command eligibility, final graph invariants, late rejection and net-no-change rejection; success increments once and publishes no intermediate state. | [Atomic commands](issues/05-prototype-command-and-conflict-contract.md) |
| Immutable history | Full historical states, prior links, caller author metadata, ordered semantic summaries/reasons, Revision ordering independent of caller clock; historical Claims do not reactivate. | [Revisions](issues/06-define-revision-and-rollback-semantics.md) |
| Settlement introduction | System-supplied introducedAtRevision; caller cannot supply it; reopen preserves old result only in history; re-settlement receives new introduction context even with identical wording. | [Revisions](issues/06-define-revision-and-rollback-semantics.md) |
| Adapter reads | Explicit Map/revision absence; runtime identifier and positive-safe-integer validation; safe-integer overflow rejection without publication; detached current/history reads; individual reads atomic, pinned historical Revision stable. | [State Adapter](issues/08-prototype-state-adapter-contract.md) |
| Adapter isolation | One instance may store distinct Maps with independent histories starting at 1; separate instances are independent; one commit addresses one Map, with no cross-Map atomic write API. | [Corrected State Adapter](issues/08-prototype-state-adapter-contract.md) |
| Concurrency | Prepared changes are not commits; prepare against a common head, then submit concurrently: exactly one success and one conflict. Same-ID competing creates yield one success and one duplicate result; independent Maps both succeed. No sleeps or prescribed winner. | [State Adapter](issues/08-prototype-state-adapter-contract.md) |
| Publication failure | A test-only internal pre-publication failure seam rejects the Promise and leaves current state and history unchanged. No new public operation or assertion about future remote unknown-commit outcomes. | [State Adapter](issues/08-prototype-state-adapter-contract.md) |
| Data ownership | Caller input captured before asynchronous work; attempt nested mutation of inputs/read results/commit results and re-read to prove isolation. Copying or freezing is valid, including throws on frozen mutation. Trusted prepared values are not an external JSON API. | [State Adapter](issues/08-prototype-state-adapter-contract.md) |
| Vertical workflows | Real domain preparation and in-memory commit together: prerequisite creation/claim/settlement unlocks downstream Frontier; explicit reopen and historical reads preserve the agreed invariants. | [Acceptance interview](issues/09-define-acceptance-contract.md) |

## Gate and exclusions

The synthesized [implementation specification](spec.md#9-mandatory-acceptance-cases-and-traceability) expands these families into named case IDs, including parameterized branches. Its assertions implement this accepted family-level contract; they are still a test plan, not executed tests.

Strict TypeScript checking and all mandatory tests must pass. Each settled rule must be traceable to a concrete scenario; implementation will expand these families into individual case identifiers. Assert stable result/error structure and state/history preservation, not message prose, private storage shape, or coverage percentages.

Rollback and Ticket/Map deletion are separate planning Maps. Authentication, sharing, rendering, networks, PostgreSQL, deployment, and plugin packaging remain outside M1. This inventory neither tests nor implements those features.
