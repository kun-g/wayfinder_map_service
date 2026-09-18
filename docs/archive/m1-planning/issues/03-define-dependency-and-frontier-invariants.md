# Define Dependency and Frontier invariants

Type: grilling
Status: resolved
Blocked by: 02

Historical planning record: resolved means planning complete, not implementation delivered. Current M1 contract: [published specification](../../../spec/m1.md). Later scope corrections supersede early source statements.

## Historical claim

Session: Codex /root
Claim timestamp: 2026-09-16T13:36:10+08:00

This records the completed planning session, not an active reservation.

## Question

Which Dependency graph shapes are valid, when may dependencies be added or removed, and exactly how is the Frontier derived across unresolved, settled, claimed, deleted, or reopened Decision Tickets?

## Answer

### Graph model

Dependency is expressed as “A depends on B”: A is the dependent and B is the prerequisite. A Dependency is satisfied only when B is settled. Multiple prerequisites have AND semantics; M1 has no OR, quorum, or conditional Dependency groups.

Both endpoints must exist in the same Map. The graph must remain directed and acyclic, with no self-dependency, duplicate edge, or dangling reference. Adding an existing edge returns `dependency_already_exists`; cycles and cross-Map edges are rejected rather than tolerated by Frontier queries.

### Mutation and settlement gates

- Dependencies may be added or removed only when the dependent Ticket is open. A settled dependent must first be reopened.
- An added prerequisite may be open or settled. A removed edge must already exist.
- Settlement requires all prerequisites to be settled; otherwise it returns `unsettled_dependency`.
- Satisfied Dependencies remain after settlement. They are not automatically discarded and continue to support reopening and historical interpretation.
- Restrictions on edits or settlement while claimed remain for **Define Claim semantics**.

### Reopening and atomicity

Every settled Ticket must have only settled prerequisites. Reopening a prerequisite with any settled transitive downstream Ticket therefore fails unless the same atomic batch explicitly reopens all affected settled downstream Tickets. M1 performs no implicit cascade.

Open downstream Tickets remain open and have their Frontier eligibility recomputed. The reopened Ticket has no Claim, as settled by **Define the Decision Ticket lifecycle and settlement model**, and enters the Frontier only if its own prerequisites are all settled.

External readers observe only the committed batch result. Every accepted batch's final Aggregate must satisfy the graph and settled-prerequisite invariants. Internal command ordering and concrete errors remain for **Prototype the atomic command and conflict contract**.

Deletion cannot leave dangling Dependencies. **Define Decision Ticket and Map deletion semantics** will decide the deletion gate and required explicit edge removal.

### Frontier

Frontier is not stored or independently mutated. It is the complete set of Tickets satisfying all three conditions:

```text
status == open
AND no Claim exists
AND every prerequisite is settled
```

An empty prerequisite set satisfies the final condition. Results are canonicalized by ascending TicketId for deterministic output; this order is not a business priority or queueing policy. The concrete ID comparison rule remains for the interface prototype.

The following changes recompute eligibility from current state:

- Creating an open, unclaimed Ticket without prerequisites admits it.
- Adding an open prerequisite excludes the dependent; adding a settled prerequisite does not change eligibility.
- Settling the final open prerequisite or removing the final unmet Dependency admits an otherwise eligible dependent.
- Reopening a prerequisite may exclude open downstream Tickets.
- Settling or claiming a Ticket always excludes it.
- Releasing a Claim or reopening a Ticket recomputes eligibility from its state and prerequisites.
- Deleted Tickets never appear in Frontier.

### Evidence

- `docs/spec/v1.md`: Frontier is derived from unresolved Tickets, settled Dependencies, and active Claims; accepted mutations are atomic.
- [Define the Decision Ticket lifecycle and settlement model](02-define-decision-ticket-lifecycle.md): open/settled states, settled immutability, and explicit reopening with historical preservation.
- Confirmed after three Grilling rounds and the 15-question convergence checkpoint on 2026-09-16.
