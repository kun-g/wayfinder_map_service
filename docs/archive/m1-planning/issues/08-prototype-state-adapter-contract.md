# Prototype the state Adapter contract

Type: prototype
Status: resolved
Blocked by: 05, 06

Historical planning record: resolved means planning complete, not implementation delivered. Current M1 contract: [published specification](../../../spec/m1.md). Later scope corrections supersede early source statements.

## Historical claim

Session: Codex /root
Claim timestamp: 2026-09-17T12:11:41+08:00

This records the completed planning session, not an active reservation.

## Question

What minimal TypeScript port should the in-memory state Adapter implement so creation, current/historical reads, atomic expected-Revision writes, and immutable Revision history preserve the pure domain boundary and remain replaceable by PostgreSQL in M2?

## Scope update

Rollback writes are outside M1; see [Define immutable Revision and history semantics](06-define-revision-and-rollback-semantics.md) and [Revision rollback planning](https://github.com/kun-g/wayfinder_map_service/issues/12). Preserve the history and introduction context that the later feature will consume, without adding rollback ports now.

Deletion is likewise outside M1; see [Ticket and Map deletion planning](https://github.com/kun-g/wayfinder_map_service/issues/17). Do not add deletion ports or require that later effort to finish before this contract can settle.

## Assets

- [Accepted State Adapter interface reference](../prototypes/state-adapter.prototype.ts)
- [Interactive preparation/commit model](../prototypes/state-adapter.prototype.html)
- [Accepted behavior and verification notes](../prototypes/state-adapter.prototype.md)

These are disposable review assets, not production implementation. The accepted contract was corrected after the user clarified that their objection concerned cross-Map writes in one request, not storing different Maps in one Adapter instance. The historical capture below predates that correction.

## Answer

Accept the linked TypeScript reference and three asynchronous operations: readCurrent(MapId), readRevision(MapId, RevisionNumber), and commit(internal prepared change). Pure preparation remains synchronous and storage-independent. M1 adds no list/search, exposed transaction handles, rollback, deletion, automatic merge, or retry cache.

### Map storage and request scope — corrected 2026-09-17

- StateAdapter is the abstract storage contract; a concrete memory Adapter instance is not bound one-to-one to a product Map. One instance may store different MapIds with isolated state, history, and Revision sequences, each starting at 1.
- Each request/prepared commit concerns exactly one Map. M1 does not expose cross-Map batch writes or cross-Map atomic transactions; this was the user's intended rejection in Q9.
- Creation tests absence of the requested MapId with null priorRevision. Existing same-ID creation returns map_already_exists. A different MapId may be created in the same instance without affecting existing Maps. The earlier adapter_occupied suggestion and per-Map-instance requirement are withdrawn.
- Reads and apply commits address the requested MapId only; a missing ID returns map_not_found, never another Map's data. Instances share no data, load no files, and retain nothing after process termination.
- This supersedes the previous single-Map interpretation while preserving the other accepted operations, numbering, isolation, and commitment rules. It does not add search/list or multi-Map request methods.

### Reads and numbering

- Current reads return detached full state; historical reads return a detached immutable Revision including its state. Missing results distinguish map_not_found from revision_not_found.
- Runtime validation rejects invalid IDs/Revision inputs through invalid_input. Numbers are positive safe integers: zero, negative, fractional and unsafe numbers are input errors; valid missing numbers are revision_not_found. Overflow rejects further changes, never wraps/resets.
- Each read is atomic, but separate reads may observe intervening commits. Pin a known Revision for a stable historical view. Reads never restore historical Claims or move the head.

### Authoritative commitment

- Commit checks Map identity and exact stored prior Revision again. Only one prepared writer against a head succeeds; a loser gets the accepted conflict and must reread/decide.
- Success publishes state and its immutable Revision together, advancing once. No partial state, orphan history, or intermediate command result is observable.
- Return committed with the exact Revision this operation wrote and its derived Frontier, not a later reread of a possibly newer head.
- Capture prepared input immutably before asynchronous work. Stored state/history and exposed results must not have writable caller aliases.
- Prepared values are opaque trusted domain output, not external JSON state-import input. Adapter checks structural identity/kind/prior/number coherence, without re-executing business commands. Type opacity is not authentication or a defense against malicious in-process code.
- Absence, duplicate creation and conflict are explicit results. Unexpected infrastructure/programming failures reject the Promise, not a fabricated domain rejection. An M1 pre-publication failure leaves state/history unchanged; this does not promise known outcomes or automatic retry for future database/network failures.

### Stored metadata and reconciliation

Stored Settlement adds system-derived introducedAtRevision, never caller-provided Settlement input. Revision contains MapId, number/prior, create/apply kind, author, ordered semantic summaries and full state; required reopen/clear reasons remain in summaries. Final specification synthesis must reconcile stored types and the internal prepared value with the earlier pure-interface reference without rewriting accepted captures.

### Historical prototype capture and evidence

- The original capture recorded a single-Map interpretation. The user subsequently clarified the Q9 misunderstanding and requested this correction. Its occupancy rule is superseded; use the corrected Answer and working references for current specification synthesis.
- Branch: codex/prototype-m1-state-adapter; capture commit: 1ed3cfa25f1a46c92bb4828925175c504ad6e054.
- Capture adds only these three assets on top of the prior command-contract capture, preserving their type dependency. No project documents or working index were staged; main was not committed or switched.
- Seven guided sequences were executed. Additional checks covered occupancy without overwrite, another valid caller MapId in a fresh instance, wrong-ID isolation, safe numbers/overflow, detached history, atomic pre-publication failure, and fresh-instance independence.
- HTML scripts and stripped TypeScript syntax parsed. This is not a type-check, full Adapter conformance run, or agent-side browser UI verification. The small empty-Ticket/title-change model is not production code.
- The old capture remains unchanged as historical evidence. No Git capture or Ticket-status change is performed by this focused correction.
- Corrected working-model verification ran all seven guided sequences and checked distinct Maps in one instance, isolated Revision/history, one-Map write isolation, duplicate-ID rejection, detached results, and all-Map nonmutation on pre-publication failure. Scripts and stripped TypeScript syntax passed; no type-check or browser UI validation was performed.
