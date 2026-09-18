# Define the Map aggregate boundary

Type: grilling
Status: resolved
Blocked by:

Historical planning record: resolved means planning complete, not implementation delivered. Current M1 contract: [published specification](../../../spec/m1.md). Later scope corrections supersede early source statements.

## Historical claim

Session: Codex /root
Claim timestamp: 2026-09-16T11:35:08+08:00

This records the completed planning session, not an active reservation.

## Question

Which state and invariants belong inside the pure M1 Map aggregate, what must be supplied at initialization, and which v1 concepts remain references or extension data rather than first-class M1 behavior?

## Answer

The M1 Map Aggregate is the current authoritative domain state for one Map. It contains `currentRevision`, but not the Revision history or its storage representation.

### Initialization and identity

- Initialization is atomic. It requires a caller-supplied `MapId`, a non-empty title, and exactly one non-empty Destination, and it creates Revision 1.
- No readable Revision 0, empty Map shell, or Destination-less Map exists.
- IDs, timestamps, actors, and authoring clients are supplied by callers. The pure domain reads no clock, generates no randomness, performs no I/O, and must be deterministic for the same state and command.
- Owner and Workspace are not Map Aggregate state in M1. Authentication, authorization, service-level tenancy, and sharing remain outside this milestone.

### First-class state

The Aggregate contains:

- Map identity, title, Destination, and `currentRevision`;
- Decision Tickets, their first-class `TicketType`, Dependencies, and Claims;
- settled Decisions nested in their Decision Tickets, including structured Evidence, References, Provenance, and extension data;
- Notes, Fog, and Scope Exclusions as first-class Wayfinder state.

The “Decisions so far” view is derived from settled Decision Tickets. It is not an independently mutable collection.

Extensions are available on the Map, Decision Ticket, Decision, and Evidence. Extension keys are namespaced and values are JSON-compatible. M1 validates portable shape but assigns no domain meaning to extension content.

### Invariants and boundary

- A Map always has exactly one non-empty Destination. A revisioned command may replace it but may not remove it.
- Permanent Map deletion is an Adapter operation. A deleted Map is absent and has no Aggregate tombstone or `deleted` state.
- M1 defines no Map-level `draft`, `active`, `complete`, or `archived` lifecycle. Frontier availability is derived; archival is an outer concern.
- `createdAt` and `updatedAt` are not duplicated in the Aggregate; Revision metadata will carry temporal provenance.
- Share Links, Recovery Bundles, rendering, authentication, authorization, owner/workspace metadata, cloning, import, archival, and production service behavior are outside the M1 Aggregate.

### Deferred detail

Exact value-object and command shapes remain for **Prototype the atomic command and conflict contract**. Decision Ticket transitions remain for **Define the Decision Ticket lifecycle and settlement model**. Revision metadata and history reconstruction remain for **Define immutable Revision and history semantics**.

### Evidence

- `docs/spec/v1.md`: every Map has one Destination and current Revision; structured Decisions, Evidence, References, and Provenance are retained; full transcripts are excluded.
- `docs/adr/0001-remote-map-is-authoritative.md`: the remote service owns canonical state, while local and rendered forms are projections.
- Confirmed through the ticket's Grilling session on 2026-09-16.
