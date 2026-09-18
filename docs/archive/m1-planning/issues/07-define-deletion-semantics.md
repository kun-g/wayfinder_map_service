# Define Decision Ticket and Map deletion semantics

Type: grilling
Status: resolved
Blocked by: 02, 03, 06

Historical scope disposition: resolved means deferred outside M1; deletion proposals were not accepted. Current M1 contract: [published specification](../../../spec/m1.md). Later scope corrections supersede early source statements.

## Historical claim

Session: Codex /root
Claim timestamp: 2026-09-17T11:58:45+08:00

This records the completed planning session, not an active reservation.

## Question

Under which conditions may a Decision Ticket be deleted, how are incoming dependencies and historical Revisions treated, and what observable guarantees must the state Adapter provide after permanent Map deletion?

## Answer

Disposition: moved outside M1, not a settled deletion behavior. On 2026-09-17 the user requested a separate planning Map for deletion, following the already confirmed rollback deferral. Both Decision Ticket deletion and permanent Map deletion are continued in [Ticket and Map deletion planning](https://github.com/kun-g/wayfinder_map_service/issues/17).

M1 supplies neither deletion commands nor deletion Adapter ports/tests. This ticket is closed to remove it as an M1 blocker; its scope disposition belongs in the Map's Out of scope, not Decisions so far.

### Unconfirmed proposals carried forward

The user requested deferral rather than accepting this question round. The following recommendations remain proposals for the later effort, not an accepted product contract:

- Delete only open Tickets; explicitly reopen a settled Ticket first, preserving its old Settlement in history.
- Do not automatically remove incoming Dependencies or cascade deletion. Explicitly remove relevant edges in an atomic batch; settled dependents require the already agreed reopen rules before edge editing.
- Explicitly release a Claim before Ticket deletion, or manually clear it with a reason when its session is unavailable. The cleanup and deletion may share a batch.
- Make permanent Map deletion a separate operation with expected current Revision and a non-blank reason. Remove current state and all history atomically, without requiring individual Ticket/Claim cleanup. Recovery-period behavior stays deferred.

The next planning session must ask the human about these choices and remaining identity reuse, race, and error behavior rather than assuming acceptance.
