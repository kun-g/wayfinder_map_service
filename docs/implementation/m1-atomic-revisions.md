# M1 atomic Map revisions slice

Implements [原子修订 Map 内容并保存历史](https://github.com/kun-g/wayfinder_map_service/issues/2) against the accepted [M1 specification](../spec/m1.md). Run `npm run typecheck` and `npm test` with the pinned dependencies described in [creation/read](m1-creation.md).

## Public boundary and stages

`decodeApplyRequest(unknown)` and synchronous `prepareApply(current, request)` share complete request/payload validation. This slice originally introduced `map.update` only; the later [Ticket/Dependency/Frontier slice](m1-tickets-frontier.md) expands the command union, structured errors and graph checks. The private preparation brand correlates create/null prior and apply/positive prior. Ordinary callers still cannot construct a prepared commit or import JSON state through the Adapter.

Preparation validates the entire request before identity/head comparison, then applies ordered replacements on private copied state. Omitted fields stay unchanged; supplied Extensions replace their complete prior value. JSON object key order and caller author/summary changes do not manufacture a revision. A no-net-change result is `final_state/no_changes`. A real change advances one safe revision and produces ordered semantic summaries. Caller time is retained and does not determine ordering. Pure preparation never publishes state.

Map title/Destination invariants are enforced by payload validation and preserved omitted fields from trusted stored current state. At this slice's original delivery, every reachable Map had empty Tickets and Frontier. Ticket graph transitions, defensive graph-fixture checks and nonempty Frontier calculation are documented in the subsequent Ticket/Dependency slice. This atomic-revision slice itself did not introduce Ticket, Dependency, Claim, content or Settlement commands.

The real memory Adapter validates internal envelope identity/kind/prior/number coherence without replaying business commands. It captures input before yielding, then performs the authoritative absence/head comparison and publication without an async gap. Each private Map entry contains a head and immutable revision records. Commit builds the complete candidate history before replacing that one entry, atomically publishing state/history together. Exact success comes from that operation's captured record, never a later current read. Separate reads may span a commit; pinned historical reads stay stable.

The internal `createMemoryAdapterWithFault` test factory is not exported from `src/index.ts`. Its synchronous callback can throw immediately before publication. It exposes the same three Adapter operations, not a fourth port, and does not promise future remote failure outcome semantics. Both create/apply injected failures reject their Promise without publication and permit a later normal attempt.

Nested input, preparation, read and commit values remain detached/frozen. No auto retry, merge, rebase, replay cache, cross-Map transaction, history listing, persistence, rollback or deletion is introduced.

## Executable traceability

| Cases | Evidence in `tests/atomic-revisions.test.ts` |
| --- | --- |
| V05/V06 | Namespace/plain JSON failures through raw and typed seams with nested paths; whole replacement, omitted fields, empty patch/batch, text preservation. |
| V08/V09 | Invalid request/current revision branches, last safe boundary and preparation overflow; malformed unsafe commit envelopes; retained UTC metadata and earlier time on later revisions. |
| A01/A02/A05 | Synchronous deterministic preparation, unchanged state/request/Adapter, complete late-payload validation before stale comparison, identity and supplied-head results. |
| A06/A07 | Ordered updates yield one complete record; unchanged and cancelling batches yield no new head/history, including differently ordered JSON keys. |
| H01/H04/S07/S08 | Full contiguous history, pinned older reads, exact commit results after later changes; no history added by input/no-op/conflict failures. |
| S04/S05/S06 | Same-head writer race without sleeps/winner selection, independent-Map applies, missing target among unrelated stored Maps, old-head replay; prior create-race/replay tests retained. |
| S09/S10/S11 | Create/apply pre-publication failure, mutable after-invocation capture, nested original/result mutation attempts, malformed envelope rejection and recovery. |

The detached public-read `observe` helper compares every known record and proposed next-revision absence for all known Maps. Compile-time fixtures additionally reject empty typed batches and unknown JSON commit input. Lifecycle/access/cycle command failures from A03 and cross-feature branches of these groups are deferred until their corresponding commands exist; this is not whole-M1 completion or a claim that all 56 scenario groups pass.
