# Synthesize the M1 implementation specification

Type: task
Status: resolved
Blocked by: 01, 02, 03, 04, 05, 06, 08, 09

Historical planning record: resolved means planning complete, not implementation delivered. Current M1 contract: [published specification](../../../spec/m1.md). Later scope corrections supersede early source statements.

## Historical claim

Session: Codex /root
Claim timestamp: 2026-09-17T13:07:39+08:00

This records the completed planning session, not an active reservation.

## Question

Compile the settled decisions and linked prototype assets into `.scratch/m1-map-core-spec/spec.md`, verify that every required M1 behavior has an explicit contract and acceptance scenario, and identify any remaining ambiguity that would block implementation.

## Scope update

Rollback and Ticket/Map deletion are separate post-M1 efforts. Include pointers to those efforts as exclusions, not M1 commands, Adapter ports, or required tests. The deletion ticket was closed by scope disposition, not by acceptance of deletion rules.

## Working asset

- [M1 Map Core implementation specification](../spec.md): synthesized public types, runtime constraints, commands/results, validation stages, reconciled PreparedCommit/StoredSettlement, immutable history, corrected multi-Map storage contract, and concrete acceptance case identifiers.

## Handoff review

Synthesis found no known implementation-blocking domain choice. Required exclusions and superseded prototype rules are explicit. The user confirmed the final handoff on 2026-09-17; neither production implementation nor formal M1 test execution is part of this task.

## Answer

Resolved by explicit human confirmation at 2026-09-17T20:03:14+08:00. The linked specification is the accepted implementation handoff: reconciled domain/input/stored/prepared types, runtime constraints, complete command and result contracts, ordered preparation and final graph gates, immutable Revision/Settlement context, and the corrected three-operation multi-Map memory Adapter with one-Map requests.

The handoff expands acceptance into 56 uniquely identified scenario groups with mandatory parameterized branches, covering all 13 command kinds and all 20 command/final-invariant/no-change error codes. Verification below is document/syntax verification only, not evidence of production type-checking or passing acceptance tests.

No known unresolved M1 planning decision remains. The parent planning Map has reached its Destination. Rollback and deletion continue through their separate planning Maps; implementation requires a separate explicit start and must preserve this handoff's scope and completion gates.

## Document verification

- Local links in the specification, matrix, Map index, and this Ticket resolve.
- All 56 acceptance case identifiers are unique; parameterized branches remain mandatory, so this is not a count of executed tests.
- The five concatenated TypeScript declaration blocks parse after TypeScript stripping. This is syntax validation only, not strict type checking.
- Each accepted command kind has a behavior row, and each command/final-invariant/no-change error code is addressed in the concrete scenario inventory.
- Current corrected Adapter semantics and rollback/deletion exclusions were checked against their source answers. No Git capture was rewritten and no production source, dependency installation, or UI verification was performed.
