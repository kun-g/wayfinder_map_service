# M1 creation/read slice

Implementation of [创建 Map 并读取 Revision 1](https://github.com/kun-g/wayfinder_map_service/issues/1), against the accepted [M1 specification](../spec/m1.md).

## Run

Verified with Node.js 26.3.0 and npm 11.16.0. Dependencies are pinned in `package-lock.json`.

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
```

The test runner and type checker include only production sources and tests, not the disposable `.scratch/` prototypes. No network server, persistence or packaging is introduced.

## Public boundary

`src/index.ts` exports runtime `parseId`, pure synchronous `prepareCreate`, and a `createMemoryAdapter` factory. Each Adapter exposes exactly three async operations: `readCurrent`, `readRevision`, and `commit`. The private prepared brand has no exported constructor. Caller author and nonblank text are retained without normalization. Calendar-valid UTC RFC3339 timestamps accept `Z`/`z` and zero numeric offsets, preserving spelling; leap-second syntax is checked at the UTC insertion positions, without consulting an external announcement service. See [RFC 3339](https://www.rfc-editor.org/rfc/rfc3339), sections 4.3, 5.6 and 5.7.

Preparation copies and recursively freezes accepted values without freezing the original input. Commit captures its input before yielding and constructs the complete immutable Revision before its synchronous absence-check/publication operation. The same record supplies both current state and historical Revision 1, so there cannot be an orphan state or history record. Reads may share frozen values, but never writable storage aliases. Instances hold only private in-memory Maps; no global registry, files or restart loading exists.

Only create preparation is mintable in this slice. `PreparedCommit` and `SemanticChange` intentionally describe the implemented creation subset; issue 2 extends them for atomic apply, and later tickets extend command summaries. The correlated stored Ticket/Settlement types follow the complete specification, but Ticket operations, nonempty Frontier calculation, apply conflicts and subsequent revisions are not delivered here.

## Acceptance traceability

| Case | Executable evidence |
| --- | --- |
| V01 | Exact Revision 1/default content/author/summary/empty Frontier; current/history agree; no Revision 0 or 2. |
| V02 | Required text, identities and author failures with paths; input errors leave every observed Map/history unchanged; whitespace and empty notes retained. |
| V03 | All six brands: boundaries, punctuation, case, Unicode/whitespace/leading-character failures; special-property names and case-distinct Maps. |
| S01 | Fresh/missing Map, existing Map missing revision, positive safe boundary; invalid read identities/numbers rejected, including missing Map reads. |
| S02 | Independent Maps begin at 1; duplicate create cannot overwrite either Map/current/history. |
| S03 | Empty independent instances, no state reload, wrong valid MapId never reveals another Map. |

`tests/create-map.test.ts` also covers this slice's unknown fields/plain JSON validation, nested ownership, create races/replay and malformed internal create envelopes. Its `observe` helper takes detached snapshots through the public read ports and checks existing Revision 1 plus absence of proposed Revision 2. `tests/types/public-contract.ts` checks ID separation, correlated stored unions/outcomes, Settlement metadata boundaries and preparation opacity through `tsc`.

These are supplemental creation branches of V04/V05/V08/V09/A01/S05/S06/S10/S11/S12, not completion of those scenario groups across M1. All 56 groups remain the final milestone gate; this slice is not an M1 completion claim.
