# Cumulative M1 executable acceptance

This matrix maps every group in [M1 section 9](../spec/m1.md) to assertions in the real public-seam suite. It is a cumulative branch-level audit, not a promise of v1 features or a replacement for tests. Each row is a scenario group, often parameterized into many tests. Final delivery additionally requires all six implementation Issues complete, strict type checking, the full suite and independent Standards/Spec review; a pending final PR is not yet delivered on main.

Run `npm run typecheck` and `npm test`. Compile-only fixtures are checked by TypeScript rather than counted as Vitest tests. No arbitrary coverage percentage, screenshot, private storage inspection or fake Adapter is a completion gate.

Test-file keys (all under `tests/`): C = `create-map.test.ts`; A = `atomic-revisions.test.ts`; T = `tickets-frontier.test.ts`; F = `frontier-enumeration.test.ts`; M = `map-content.test.ts`; Q = `claims.test.ts`; S = `settlements.test.ts`; P = `types/public-contract.ts`.

| Group | Executable file(s) and asserted branches |
| --- | --- |
| V01 | C: exact empty defaults/Destination/author/Revision 1, null prior/map.create, matching reads/empty Frontier, no Revision 0. |
| V02 | C: missing/blank title/Destination, invalid authors, no publication; nonblank whitespace and empty notes preserved. |
| V03 | C/T/M/Q/S/P: six ID kinds/boundaries/punctuation/case/invalid syntax, prototype-like names, local identity reuse and command-field brand checks. |
| V04 | C/A/T/M/Q/S: unknown fields, illegal imported status/Claim/history/entity/author metadata, caller introduction number, plain data descriptors. |
| V05 | C/A/T/M/S: valid nested/shared acyclic JSON and namespaced Extensions; invalid namespace/nonfinite/cycle/function/symbol/nonplain values; arbitrary-key plain-record resulting facts. |
| V06 | A/T: whole Map/Ticket Extensions replacement, omitted fields retained, empty patches/batches rejected. |
| V07 | M/S: opaque nonblank locators, labels, nonblank Provenance methods, Evidence requiring References or explicit Provenance, all nested source arrays. |
| V08 | C/A/S: safe positive read/request bounds, invalid current/read/request numbers, last-safe preparation, head overflow, malformed unsafe internal envelopes. |
| V09 | C/A/S: retained valid UTC forms, calendar/offset invalidity, earlier author time on later revisions without reordering. |
| T01 | T/Q/S: four open/unclaimed types with no result/prerequisites, duplicate IDs, nonexistent/local-only target rejection. |
| T02 | T/S: open descriptive/type/Extensions edits and immutable identity; actual settled Ticket/dependent edits rejected. |
| T03 | S/P: all four correlated result types, one result/no Claim, invalid command type/outcome shape, all actual-vs-command type mismatches. |
| T04 | S: required Decision rationale, Finding Reference-only/Evidence-only/source fallback and inconclusive variants, unsupported unsourced Finding, optional Completion facts/omitted fields. |
| T05 | S: missing/mismatched Claim, command-position unsettled prerequisite; whole late-failure batch preservation. |
| T06 | S: exact nonblank reopen reason, open targets rejected whether claimed or not, no current Settlement/Claim, descriptions/Dependencies retained and old result readable. |
| T07 | S: introduction number equals one batch commit, unrelated edit preserves it, same wording re-settles with new number/author both across revisions and within one batch. |
| T08 | M: both columns add/update/remove/full replacement, cross-column duplicates, selected-column missing/wrong targets. |
| T09 | M: real Fog graduation plus Ticket creation once, prior full References retained, late failures atomic; unavailable Ticket/Map delete and rollback commands. |
| G01 | T/S: local AND prerequisites, either open prerequisite blocks, settled prerequisites enable, cross-Map-only endpoint fails, real settlement retains edges. |
| G02 | T: self/duplicate/missing edge/missing endpoint errors, final cycle rejected, temporary cycle repaired; all error positions/IDs asserted. |
| G03 | T/S: last unmet edge removal unlocks, actual settlement retains satisfied dependencies and unlocks dependent Frontier. |
| G04 | S: upstream alone and only-direct-descendant reopen fail with settled transitive descendants; explicit upstream-first complete reopening succeeds without cascade. |
| G05 | Q/S: adding open prerequisite or reopening upstream blocks a Claim; both explicit release and clear permit valid final state, no silent removal. |
| G06 | C/T/F/Q/S: empty/isolated/claimed/settled/blocked/multiple eligible sets, exact once-only ascending ASCII order through pure preparation and real commits. |
| G07 | F: 4,166 simple directed graphs on 0–4 nodes; independent adjacency/closure oracle and legal lifecycle/Claim assignments, separate cyclic preparation rejection. |
| G08 | T: malformed dangling prerequisite fixture with valid Map edit rejected by public preparation, no fixture mutation or storage publication/import port. |
| C01 | Q/S: eligible acquisition, repeated same/different claimant, blocked/settled rejection, before/after prerequisite settlement command order. |
| C02 | T/Q/S: all claimed descriptive/dependent-edit branches need matching session, unclaimed planning needs none, fresh revision cannot bypass mismatch. |
| C03 | Q: exact matching-target release, absent/mismatched Claim codes, other Claims unaffected and Frontier unlocked. |
| C04 | Q/S: expected claimant/head, exact nonblank reason, stale preparation/commit conflict, absent/mismatched Claim/invalid reason, structured ordered summary. |
| C05 | Q/S: release/clear plus different-session transfer once, acquire/release and other cancelling Claim batches no_changes. |
| C06 | Q/S/P: one claimant holds multiple reservations with no quota, differing revision actor succeeds at matched settlement, ClaimId/lease fields rejected. |
| A01 | A/T/Q/S: equivalent synchronous/private deterministic preparations, supplied state/request unchanged, preparation never acquires durable Claims. |
| A02 | A/T/M/Q/S: complete late input validation precedes semantic execution and stale-head comparison, exact nested paths and no publication. |
| A03 | T/M/Q/S: valid early mutations plus later missing target/lifecycle/access/final-cycle failures reject all with submitted index and full-history preservation. |
| A04 | Q/S: acquire/settle prerequisite before dependent succeeds in one batch; dependent acquisition/settlement before later prerequisite settlement fails at its position. |
| A05 | A/Q: identity mismatch invalid_input, stale supplied head structured Conflict; stale clear checked again by real commit. |
| A06 | A/T/M/Q/S: valid ordered multi-command changes increment once with one complete Revision and ordered subjects/reasons. |
| A07 | A/T/M/Q/S: empty/unchanged/cancelling changes do not manufacture history from new head/author/summary; prerequisite reorder no-op; re-settlement is a new introduction. |
| H01 | C/A/T/M/Q/S: exact full states, identity/revision coherence, contiguous prior links, create/apply kinds and retained caller authors. |
| H02 | Q/S: clear/reopen reasons preserved exactly with required submitted command positions; structured operation summaries. |
| H03 | Q/S: historical Claim visible after release/transfer/settle/reopen, reads never reacquire/restore/move head or Frontier. |
| H04 | A/T/M/Q/S: all prior full snapshots remain after accepted changes; failed/conflicted/no-op requests add none; old re-settled introductions unchanged. |
| S01 | C: fresh/valid missing Map, existing valid missing revision, invalid identities/numbers including absent Map. |
| S02 | C/A/T/M/Q/S: duplicate create no overwrite, independent Map revisions/local ID reuse and no cross-Map leakage. |
| S03 | C: independent empty instances with no reload/global registry; valid wrong MapId yields no other data. |
| S04 | A/T/Q/S: Promise.all same-head writer/Claim/Settlement races, exactly one commit/one Conflict, no sleep or prescribed winner, no losing record. |
| S05 | C/A: same-ID create race one winner, different-ID creates and independent-head applies can both commit. |
| S06 | C/A: duplicate create replay, old apply replay Conflict, prepared apply to missing target rejected with unrelated Maps intact; no automatic retry. |
| S07 | A/T/M/Q/S: exact committed Revision/Frontier remains pinned after later head, never assembled from latest reread. |
| S08 | A/S: stable pinned earlier full Revision reads while later commits proceed; separate reads not a new transactional port. |
| S09 | C/A/T/M/Q/S: create/apply pre-publication failures across populated Maps preserve complete histories and absent proposals; explicit retry remains possible. |
| S10 | C/A/T/M/Q/S: original/current/prepared/read/commit nested Extensions/References/Claim/result/reason/author/Evidence/Provenance/facts mutation cannot alter storage. |
| S11 | C/A/M/S: mutable trusted internal envelopes captured before yield/publication, malformed envelopes reject Promise without publishing/replaying commands; nested result capture tested. |
| S12 | P/S: branded IDs, open/settled/result and command narrowing, no caller introducedAtRevision, opaque preparation, required reasons/plain-record facts/no additional public ports; runtime bypass fixtures still validate. |
| E01 | S: real create → dependency → prerequisite Claim/settlement → exact unlock → dependent Claim/settlement → explicit reopen both → current/history/introduction/Claim checks. |

Negative scenarios take detached observations through readCurrent/readRevision, compare complete current states and every known historical record, check proposed-next absence and unrelated Maps. Pure defensive/overflow fixtures supplement real observations without adding a state import API. The internal synchronous failure callback tests the same commit port, not a fourth public operation.

Rollback, Ticket/Map deletion, rendering, OAuth, PostgreSQL, network/MCP transport, export/recovery/sharing and packaging remain outside this milestone. Do not interpret Ticket reopen or immutable history as implementation of those later features.
