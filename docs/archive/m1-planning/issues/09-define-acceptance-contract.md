# Define the executable M1 acceptance contract

Type: grilling
Status: resolved
Blocked by: 03, 04, 05, 06, 08

Historical planning record: resolved means planning complete, not implementation delivered. Current M1 contract: [published specification](../../../spec/m1.md). Later scope corrections supersede early source statements.

## Historical claim

Session: Codex /root
Claim timestamp: 2026-09-17T12:58:56+08:00

This records the completed planning session, not an active reservation.

## Question

Which black-box scenarios, conformance checks, and invariant-focused tests are necessary and sufficient to prove the M1 domain and in-memory Adapter satisfy the destination, including whether property-based or model-based tests add material confidence?

## Scope update

Cover immutable historical state, Settlement introduction context, atomic Revision commits, and conflicts. Rollback behavior and rollback tests belong to [Revision rollback planning](https://github.com/kun-g/wayfinder_map_service/issues/12), not this M1 acceptance contract.

Ticket/Map deletion behavior and tests belong to [Ticket and Map deletion planning](https://github.com/kun-g/wayfinder_map_service/issues/17), also outside this M1 contract.

## Accepted interview decisions — round one

- Exercise public pure-domain operations, the real in-memory State Adapter through its contract, and complete read → prepare → commit flows. Do not couple acceptance to private storage or internal algorithms.
- Require successful, rejected, and conflicting examples plus bounded small-graph enumeration for DAG/Frontier invariants. M1 does not require a full reference state machine or a random testing framework.
- Assert stable error codes, applicable input paths/command positions, and unchanged complete current state and history after unsuccessful operations. Do not assert human-readable message wording or screenshots.
- The completion gate is strict TypeScript checking and all mandatory acceptance tests passing, with each settled rule traceable to a scenario. No arbitrary coverage-percentage gate or UI/network/database acceptance.

## Accepted interview decisions — round two

- Enumerate directed dependency graphs for 0–4 Tickets and legal status/Claim combinations. Compare the exact Frontier set and ASCII lexical ordering with a simple independent oracle, not the production Frontier helper. Cyclic graphs are separately required to be rejected.
- Prepare competing changes against the same head before concurrent submission. Require exactly one success and one conflict without prescribing the winner or relying on sleeps. Concurrent same-ID creates yield one success and one duplicate result; independent Maps may both commit successfully.
- Allow a test-only internal pre-publication fault-injection seam, not an additional public Adapter operation. An injected unexpected failure rejects the Promise and leaves current state and history intact; future remote unknown-commit outcomes are not covered.
- Attempt nested mutation of caller input, read results, and commit results, then re-read to establish storage/history isolation. Both defensive copying and freezing are valid; a frozen mutation may throw. Do not mandate an internal representation.

## Convergence checkpoint

The two accepted rounds settle the acceptance approach and its bounded techniques. No remaining acceptance-method choice has been identified. The user explicitly confirmed the consolidated conclusion on 2026-09-17. Production implementation and specification synthesis have not started.

## Answer

Resolved by explicit human confirmation at 2026-09-17T13:06:38+08:00. Both accepted interview rounds above define the M1 acceptance contract: black-box domain and real in-memory Adapter coverage, bounded 0–4-Ticket enumeration with an independent oracle, deterministic competing submissions, pre-publication fault injection, nested data isolation, and strict type-check/test/traceability gates.

The linked matrix inventories required scenario families derived from the settled domain, command, Revision, and corrected multi-Map Adapter contracts. It is an accepted planning artifact, not evidence that tests have been implemented or passed. Concrete case identifiers and rule-to-case traceability will be expanded during specification synthesis and implementation without weakening these requirements. Rollback, deletion, rendering, authentication, and external infrastructure remain excluded.

## Working asset

- [M1 acceptance matrix](../acceptance-matrix.md): accepted scenario inventory reflecting both confirmed interview rounds, not executable tests or production implementation.
