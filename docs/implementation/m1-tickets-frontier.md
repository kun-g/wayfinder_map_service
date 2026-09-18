# M1 Ticket, Dependency and Frontier slice

Implements [维护 Decision Ticket、Dependency 与 Frontier](https://github.com/kun-g/wayfinder_map_service/issues/3) against the accepted [M1 handoff](../spec/m1.md), building on [atomic Map revisions](m1-atomic-revisions.md). Use `npm run typecheck` and `npm test` with the pinned dependencies.

## Behavior and boundaries

The public command subset now supports `map.update`, `ticket.create`, `ticket.update`, `dependency.add` and `dependency.remove`. Creation accepts all four TicketTypes and caller IDs unique within one Map. It always starts open/unclaimed, with no Settlement or prerequisites. Update replaces only supplied descriptive fields; supplied Extensions replace the entire prior object. Stored lifecycle, identity and prerequisites cannot be imported or patched through TicketInput.

Dependencies use local TicketId endpoints and AND semantics. Only open dependents can be changed; prerequisites can be open or settled. Structured command errors retain the failed array position and relevant identities. Ordered commands operate on a private copy. Complete payload validation still precedes supplied-head comparison and command execution; a late failure cannot publish an earlier successful change.

Preparation checks the complete final graph before no-op detection and revision advancement. It rejects cycles, dangling endpoints, settled Tickets with open prerequisites and claimed Tickets with open prerequisites. Iterative topological elimination avoids a recursive traversal limit. A temporary cycle repaired by a later command can succeed; a failed command cannot be repaired by a later command. Cancelled edits with identical final state yield `no_changes`.

Public `calculateFrontier` derives exactly open, unclaimed Tickets with every prerequisite settled, returning immutable ascending ASCII lexical TicketIds. The empty prerequisite set is eligible. Frontier is not stored as another index or Map field. Preparation derives it from its proposed state; the Adapter derives it from the exact immutable Revision being published, without a later current-head read. The Adapter still exposes only the same three asynchronous ports.

Existing claimed/settled states are exercised with coherent fixtures through the pure public boundary, not with an Adapter import API. Matching-access gates preserve existing reservations, but no Claim acquire/release/clear or settlement/reopen command is introduced. Those later slices must supplement C02 and G03/G04/G05 with transitions actually reachable through their new commands; fixture evidence does not mark those cross-feature groups complete. Fog/Scope editing, persistence, rendering, rollback and Ticket/Map deletion remain outside this slice.

## Executable traceability

| Cases | Evidence |
| --- | --- |
| T01/T02 | Four types start open/unclaimed; immutable local identity; duplicate/missing/settled edit failures; whole Extensions replacement and preserved omitted fields. |
| G01/G02 | Local AND prerequisites, open/settled prerequisite fixtures, cross-Map-only endpoint refusal; self/duplicate/missing-edge/missing-endpoint errors; final cycle refusal and repaired temporary cycle. |
| G03 | Removing the last unmet Dependency unlocks a dependent via real commits. Retention of satisfied edges is checked on settled fixtures; actual settlement transition is deferred. |
| G06 | Empty, isolated, blocked, claimed, settled and multiple-eligible fixtures; exact set and ASCII ordering from preparation and real commits. |
| G07 | `tests/frontier-enumeration.test.ts` enumerates every simple directed graph without self edges on 0–4 Tickets (4,166 graphs total). An independent Boolean adjacency-matrix/transitive-closure oracle checks DAGs and all legal open/unclaimed, open/claimed, settled/unclaimed assignments. Cyclic fixtures must fail public preparation. Self edges are separately refused at the command boundary in G02. No production Frontier/graph helper, random framework or command reference model is used by the oracle. |
| G08 | A dangling current-state fixture plus a valid Map update is rejected through public `prepareApply`; no public validator or storage import port. |
| V03/V04/V06, A01/A02/A03/A06 | Raw/typed strict payload paths, late-input precedence over stale heads, ordered semantic summaries and one Revision, private deterministic preparation and rejection/no-op preservation. |
| S04/S07/S09 | Nonempty-state race publishes one exact captured Revision/Frontier; pinned results survive later heads; nested caller/result mutation cannot alias storage; injected publication failure leaves all known heads/history untouched. |

`tests/tickets-frontier.test.ts` uses the real memory Adapter and public reads. Negative cases compare complete detached observations of every known current/history record, unrelated Maps and proposed next-revision absence. Enumeration cycles similarly compare both known Maps' full current, Revision 1 and absent Revision 2 after each refusal. Tests assert codes, paths and command indices, not error prose or private dictionaries. Strict compile-only fixtures additionally reject wrong endpoint/access brands and caller-editable stored fields.

This is slice-level verification, not whole-M1 completion or a claim that every branch of all 56 acceptance groups is implemented.
