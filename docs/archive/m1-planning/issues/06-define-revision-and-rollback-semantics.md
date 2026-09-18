# Define immutable Revision and history semantics

Type: grilling
Status: resolved
Blocked by: 05

Historical planning record: resolved means planning complete, not implementation delivered. Current M1 contract: [published specification](../../../spec/m1.md). Later scope corrections supersede early source statements.

## Historical claim

Session: Codex /root
Claim timestamp: 2026-09-17T11:29:55+08:00

This records the completed planning session, not an active reservation.

## Question

What must each Revision record, how is historical state reconstructed, and how is the original introduction context of accepted content preserved? Which previously discussed rollback behavior is transferred to a separate post-M1 planning effort?

## Context from prior decisions

[Prototype the atomic command and conflict contract](05-prototype-command-and-conflict-contract.md) distinguishes pure preparation from authoritative atomic commit. Creation has null priorRevision; accepted apply batches increment once. Settlement has no independent entity ID, while its introducing Revision supplies mutation authorship and time.

Explicitly decide how rollback treats historical Claims and Settlement introduction context, rather than assuming that restoring an earlier snapshot should silently reactivate a work-session reservation or assign new semantic authorship to an old result.

## Answer

Human-confirmed on 2026-09-17: M1 retains immutable Revision history and stale-state protection; rollback implementation and acceptance move to [Revision rollback planning](https://github.com/kun-g/wayfinder_map_service/issues/12). The filename is retained for existing links; the title and current scope now concern Revision history.

### M1 Revision contract

- A Revision is one accepted atomic Map change, not one command or chat message. Creation is Revision 1 with null priorRevision; each accepted batch advances the current head once. Failed, conflicted, and no-net-change operations create no Revision.
- Each immutable record contains MapId, revision number, prior revision number, caller-supplied actorId/clientId/occurredAt, change kind, full resulting Map state, and ordered structured semantic change summaries. M1 change kinds are create and apply; rollback metadata belongs to the later effort.
- Revision number determines order. Caller-supplied UTC time describes the mutation and is not a clock authority or sorting guarantee. IDs and authorship use the accepted runtime input contract.
- Full historical state includes the actual Claims present when that Revision committed. Historical reads do not acquire or reactivate those Claims. Derived Frontier is calculated from a selected state, not independently persisted.
- Historical state is read directly from its immutable record; M1 does not require event replay. Structured summaries describe semantic operations, including explicit reasons where required, rather than chat transcripts or an instruction stream for reconstruction.
- The Adapter atomically persists current state and its immutable Revision under an authoritative expected-prior-Revision comparison. A prepared change is not durable success. Published historical records and returned state must not be mutable aliases through which callers can change stored history.
- Comparing two historical states determines actual content differences; ordered operation summaries are not a substitute for that comparison. Rendering the comparison remains outside M1.

### Settlement introduction context

- Add system-derived introducedAtRevision to a stored Settlement. It points to the Revision that first accepted that Settlement in its containing Ticket; it is not a new entity ID and is not caller-selectable Settlement input.
- The introducing Revision supplies mutation actor/client/time; Settlement Provenance continues to describe semantic source and method. Do not duplicate those mutation metadata fields into the Settlement.
- Reopening removes the current Settlement but preserves it in history. Settling again introduces a new Settlement with the new introducing Revision, even if its wording happens to match an older result.
- Creation/apply summaries, full state, and Settlement introduction context must be represented coherently in the final implementation specification. This adds stored metadata to the earlier throwaway type reference without modifying its immutable accepted capture.

### Accepted baseline for deferred rollback

These are agreed planning constraints, not M1 commands or tests. The later effort consumes them and settles remaining interface, storage, error, and acceptance details.

- Rollback restores the target Revision's entire Map content, not one Ticket. It changes the existing product Map, creates a new head Revision, and never changes or removes earlier history. Creating another planning Map does not imply cloning a product Map.
- Restore Destination, Tickets, Dependencies, Settlements, Notes, Fog, Scope Exclusions, and extensions, while clearing all restored Claims. Do not reactivate past work-session reservations.
- Preserve original Settlement introduction context and Provenance. Record the rollback actor/client/time as new mutation metadata, not as new authorship of the recovered outcomes.
- Require expected current Revision, an existing target Revision from the same Map, and a non-blank reason. A stale head returns conflict instead of overwriting newer changes. Record target Revision and reason in the new rollback record.
- Reject a rollback with no actual resulting content change, ignoring new head number and operation metadata in that comparison. Clearing a current Claim is an actual change.

### Scope confirmation

The user accepted both recommendation rounds and explicitly confirmed moving rollback to a separate iteration. M1 Revision history remains the prerequisite foundation, not the rollback feature itself. No production implementation or rollback API was created by this resolution.
