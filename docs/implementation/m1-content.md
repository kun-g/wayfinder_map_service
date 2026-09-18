# M1 Fog and Scope Exclusion content slice

Implements [维护 Fog、Scope Exclusions 并完成 Fog graduation](https://github.com/kun-g/wayfinder_map_service/issues/4) against the accepted [M1 specification](../spec/m1.md), following [Ticket/Dependency/Frontier](m1-tickets-frontier.md). Run `npm run typecheck` and `npm test` with the pinned dependencies.

## Public behavior

The public command union now includes `content.add`, `content.update` and `content.remove`. Section must be exactly `fog` or `scopeExclusions`. MapContent consists only of caller ContentId, nonblank text and a Reference array. Reference locator is nonblank opaque text, retained without normalization or fetching; an optional label must be a string and may be empty. Empty Reference arrays and plain null-prototype objects are accepted. Unknown core fields, malformed IDs, nonplain objects/arrays, sparse/accessor/nonenumerable elements and extra array properties are rejected with input paths. Commands, References and plain-JSON arrays share an internal array-shape check; domain-specific element validation and empty/nonempty rules remain at their callers. No internal validation helper is exported from the public entry point.

Content IDs are unique across both sections of one Map, not across Maps or shared with TicketIds. Addition rejects a duplicate in either section. Update replaces the complete supplied item identified by its ID, retaining section and list position; removal affects only that item's selected section. Missing or wrong-section targets return `content_not_found`. Content errors use the existing command-stage envelope and failed commandIndex, with an empty ticketIds array because no Ticket is the error subject.

Complete raw/typed payload validation still precedes stale-head checks and private ordered execution. Removing precise Fog and creating its new Ticket in one request saves exactly one new Revision; a late input/command error preserves the old Fog, Frontier and all history. No-op/cancelled edits cannot manufacture history. Full historical states retain earlier text and References after later update/removal. Nested inputs, preparations, public reads, commits and Reference arrays/objects remain detached/frozen, and commit captures nested References before yielding.

Fog and Scope Exclusions never become Frontier candidates or Dependency endpoints themselves. Only explicit Ticket creation changes Frontier in the promotion flow. No automatic Reference migration to a new Ticket is invented; the original content remains attributable in the prior full Revision. `content.remove` is column-content editing, not the deferred Ticket/Map deletion feature.

The Adapter still has only readCurrent, readRevision and commit. No new public import/validation/fault port, Claim/settlement command, persistence, authentication, renderer, rollback or Ticket/Map deletion is introduced. The existing internal publication fault factory is used only to exercise the same commit port.

## Executable traceability

| Cases | Evidence in `tests/map-content.test.ts` |
| --- | --- |
| T08 | Both sections parameterized for add/update/remove, complete replacement, section/identity preservation, cross/same-section duplicate, missing/wrong-section target, local ID reuse across Maps. |
| T09 | Real Fog removal plus Ticket creation in one Revision; earlier full References retained; late failures preserve old Fog/Frontier; content-only IDs do not qualify as Dependency endpoints, and Fog/Scope entries do not enter Frontier. Deferred delete/rollback command kinds remain unavailable. |
| V03/V04/V07 | ContentId/runtime shape checks, prototype-like IDs, nonblank opaque locators and text with whitespace retained, optional labels, null-prototype objects and empty References; malformed nested inputs reject with full paths through both decoding and typed preparation. This slice covers the Reference branch of V07, not the later Settlement Provenance/Evidence branches. |
| A02/A03/A06/A07 | Whole-input precedence over stale comparison, late command positions and no partial effect, one ordered semantic summary batch/Revision, unchanged updates and cancelling updates/add-remove edits produce no history. |
| H01/H04 | Exact current and complete earlier full snapshots, contiguous links and unchanged history after removal/failure/conflict/no-op. Settlement/reopen history branches remain deferred. |
| S09/S10/S11 | Failure immediately before Fog-promotion publication preserves both populated Maps, every known Revision and absent next records; nested original/current/prepared/read/commit Reference mutations cannot alias stored content/history; after-invocation mutation of a trusted internal envelope cannot change captured References. |
| S07/S12 | Stale content proposal cannot overwrite the winner; pinned commit output remains exact after later revisions; strict compile-only fixtures reject wrong ID brands, section values and Reference label types. |

Every negative test uses detached public observations of all known Maps' complete current states and known revisions plus proposed-next absence; unrelated Maps stay unchanged. Assertions target structured codes, paths and commandIndex, not prose, private dictionaries, mocked collaborators or screenshots.

This verifies the approved content slice only. Claim transitions and Settlement/reopen remain for subsequent implementation tickets; not every branch of all 56 M1 acceptance groups is delivered yet.
