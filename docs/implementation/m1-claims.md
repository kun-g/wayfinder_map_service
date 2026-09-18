# M1 Claim coordination slice

Implements [通过 Claim 协调 Ticket 处理](https://github.com/kun-g/wayfinder_map_service/issues/5) against the accepted [M1 specification](../spec/m1.md), after [Fog and Scope content](m1-content.md). Run `npm run typecheck` and `npm test` with the pinned dependencies.

## Public behavior

The public command union adds `claim.acquire`, `claim.release` and `claim.clear`. A stored Claim is only an opaque caller-supplied ClaimantId identifying a logical work session. It is not an ActorId or ClientId, and has no independent entity ID, duplicated author/time, session registry, authenticity check, quota, lease, expiry or automatic takeover. The revision author need not have the same spelling as the claimant. One claimant may acquire multiple eligible Tickets.

Acquisition checks the command-position state: the target must exist locally, be open, unclaimed and have every prerequisite settled. It uses the same pure Frontier eligibility calculation as preparation and commit reads. Repeated acquisition by either the same or a different session returns `ticket_already_claimed`; blocked acquisition returns `unsettled_dependency`; settled targets return `ticket_not_open`. Matching release clears only its target Claim. Missing Claim is `claim_not_found`; mismatched release or clear is `claim_mismatch`.

Existing Ticket/dependent-edge edits require matching optional Access claimantId only when their target is claimed. Unclaimed planning still requires no Claim. A fresh expectedRevision does not bypass claimant matching. Final graph checks prohibit a claimed Ticket with open prerequisites, unless the ordered batch explicitly releases/clears that Claim. Temporary blocking can be repaired later in the batch; acquisition itself must be eligible at its own command position, not merely after a later repair.

Clear uses expectedClaimantId, the request's expectedRevision and a nonblank reason. This is deliberate manual override, not administrator authentication. Required IDs/reasons and unknown fields are validated across the complete request before stale-head comparison or execution. Reasons retain exact whitespace and appear in ordered semantic summaries with the Ticket ID and submitted commandIndex.

Release/clear followed by a different-session acquisition transfers in one immutable Revision, with no intermediate published head. Acquire/release or release/clear followed by same-session acquisition without any net business-state change returns `no_changes`; a new author or reason cannot manufacture history. Historical snapshots retain their actual Claims after later transfers or release. Reading them neither reserves work nor restores the Claim or changes current Frontier/head.

The memory Adapter still exposes only readCurrent, readRevision and commit. Same-head Claim proposals use its existing atomic head comparison/publication; exactly one wins, and the loser conflicts without overwriting it. Pre-publication failure leaves every Map/current/history unchanged. Inputs and exposed prepared/read/commit values cannot mutate stored Claims, reasons or authors through writable aliases.

## Executable traceability

| Cases | Evidence in `tests/claims.test.ts` |
| --- | --- |
| C01/G01/A01/A04 | Real decode → prepareApply → commit acquisition, exact full Revision/Frontier and private deterministic preparation; repeat acquisition by same/different session, blocked command-position acquisition before later repair, local-only target and settled-target rejection. Coherent pure stored-Settlement fixtures cover AND-satisfied acquisition until the later settlement command exists; they are not imported or committed to storage. |
| C02/G05/A03/A06 | Live claimed Ticket/dependency edits require matching session; fresh head does not bypass access, unclaimed planning needs none; final blocking dependency rejects with no silent Claim removal, explicit release/clear after blocking permits one valid final commit. The upstream-reopen branch of G05 remains for issue 6. |
| C03/C04/C05/H02 | Release and clear unlock exactly their target; absent/mismatched claims are distinguished; stale clear conflicts at both preparation/commit; different-session transfers commit once with exact ordered reasons, cancelling batches and metadata-only changes produce no history. |
| C06/V03/V04/A02 | Multiple reservations per session with no actor equality; opaque spelling/length/punctuation/prototype-like IDs, malformed target/session IDs, blank/missing reasons, forbidden ClaimId/lease/author/session metadata, unsupported access keys and getters reject through raw and typed seams before earlier execution/stale comparison. Actor-different settlement remains for issue 6. |
| H01/H03/H04/S04/S07/S09/S10 | Exact current and complete earlier snapshots, no historical reacquisition/restoration, one same-head winner/one Conflict without a prescribed winner, fresh-head takeover attempts still reject, exact pinned commit output after later release, failure before publication and explicit retry, mutation attempts across inputs/current/prepared/read/commit Claim/reason/author values. |
| S12 | Compile-only public-contract fixtures reject wrong target/session brands, missing clear fields, independent ClaimId and expiry metadata. |

Every negative scenario observes complete real current states and all known historical records for both populated Maps, checks proposed-next absence, and verifies unrelated Maps stay unchanged. Assertions use structured errors/paths/positions rather than error prose or private storage inspection. Pure fixture checks also verify the fixture/input are not mutated and that real storage remains untouched.

This delivers issue 5 only, not all 56 M1 acceptance groups. Settlement and reopen (including settlement clearing a Claim, upstream-reopen interactions and the full E01 flow) remain in [issue 6](https://github.com/kun-g/wayfinder_map_service/issues/6). No rollback, Ticket/Map deletion, sharing, authentication, UI, persistence or transport is added.
