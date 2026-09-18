# Define the Decision Ticket lifecycle and settlement model

Type: grilling
Status: resolved
Blocked by: 01

Historical planning record: resolved means planning complete, not implementation delivered. Current M1 contract: [published specification](../../../spec/m1.md). Later scope corrections supersede early source statements.

## Historical claim

Session: Codex /root
Claim timestamp: 2026-09-16T13:15:59+08:00

This records the completed planning session, not an active reservation.

## Question

What are the valid Decision Ticket states and transitions, and how are a settled Decision, its Evidence, references, provenance, and any reopening behavior represented without storing full transcripts?

## Answer

### State model

A Decision Ticket has only two states: `open` and `settled`. Claim is an independent optional relationship, Dependency blocking is derived, and deletion means the Ticket is absent. M1 adds no `in_progress`, `blocked`, `failed`, `cancelled`, `rejected`, or `obsolete` state.

Creation atomically produces an `open` Ticket with a caller-supplied immutable `TicketId`, non-empty title, non-empty question, `TicketType`, optional extensions, no Claim, and no Settlement. Dependencies are added separately. While open, the title, question, type, and extensions may be changed by revisioned commands; the Ticket ID never changes. Restrictions while claimed remain for **Define Claim semantics**.

### Settlement

The only normal terminal transition is `open -> settled`. It atomically attaches exactly one Settlement; a settled Ticket without a Settlement and a result without a settled Ticket are invalid intermediate states.

Settlement outcome is determined by Ticket Type:

- `grilling` and `prototype` produce one Decision;
- `research` produces one Finding;
- `task` produces one Completion.

Each Ticket has one coherent outcome. Materially independent results with different future dependencies become separate Decision Tickets.

A Decision requires a non-empty statement and rationale. A Finding requires a non-empty statement and may record limitations. A Completion requires a non-empty statement and may record structured resulting facts. The Settlement also contains Evidence, References, semantic Provenance, and extensions; exact TypeScript shapes remain for **Prototype the atomic command and conflict contract**.

Decision evidence is optional because a preference or constraint may be decisive without an external fact. A Finding requires at least one Evidence or Reference, including the checked scope and sources for an inconclusive finding. Completion evidence is optional, but reusable facts belong in its structured result.

### Failure, correction, and reopening

Only an accepted result settles a Ticket. An inconclusive research effort may settle with a Finding that explicitly states its checked scope and limitations. An unfinished task cannot settle with a Completion. Work that cannot yet finish remains open until it is replanned, deleted, or ruled beyond the Destination as a Scope Exclusion.

A settled Ticket is wholly immutable. Correction requires an explicit `settled -> open` transition. Reopening removes the current Settlement from the current Aggregate, clears any Claim, and leaves the descriptive Ticket fields available for revision before a later settlement. The immutable Revision history retains the earlier Settlement. The effect of reopening on dependent Tickets remains for **Define Dependency and Frontier invariants**.

### Transcript and provenance boundary

The Map stores compact accepted results, Evidence, References, and semantic Provenance, not the full conversation, chain of thought, raw Grilling transcript, or activity log. References point to external source material when later inspection is needed.

Actor, authoring client, and time are recorded by the Revision that introduces the Settlement and are not duplicated inside it. Settlement Provenance records how the result was produced and may identify a source Grilling Session, research artifact, prototype, or external source Reference.

### Evidence

- `docs/spec/v1.md`: structured Decisions, Evidence, References, and Provenance are retained while full transcripts are excluded.
- [Define the Map aggregate boundary](01-define-map-aggregate-boundary.md): the current Aggregate holds settled results while immutable Revision history lives behind the Adapter.
- Confirmed through the ticket's Grilling session on 2026-09-16.
