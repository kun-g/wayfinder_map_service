# State Adapter contract — accepted throwaway reference

Status: historical accepted interface reference, corrected on 2026-09-17 and consolidated into the [published M1 specification](../../../spec/m1.md). The original capture commit remains superseded where noted.

Question: does a three-operation asynchronous storage interface correctly distinguish pure preparation from atomic commitment, preserve immutable history, and expose conflicts without hiding them?

## Assets

- [Interface draft](state-adapter.prototype.ts)
- [Interactive commitment model](state-adapter.prototype.html)

## Accepted operations

Three asynchronous operations: read current Map, read specified Revision, and commit prepared change. Creation tests absence through null priorRevision. Missing Map/Revision and duplicate creation have explicit results; duplicate creation never overwrites an existing Map.

## Accepted behavior

- Commit success returns the exact committed Revision, including its state, and derived Frontier. It does not reread a potentially newer head to form the result.
- Apply checks the authoritative stored head again, even when preparation previously succeeded. A losing writer gets conflict, not an automatically rebased write.
- Each read is individually atomic and detached; two separate reads may observe different heads. Read a specific immutable Revision for a stable view.
- State and history publish together. Unexpected infrastructure/programming failures reject the Promise rather than masquerading as normal domain outcomes. A simulated in-memory failure before publication leaves both unchanged; this is not a guarantee about unknown network commit outcomes in a future database Adapter.
- Prepared values are internal trusted domain output, not an external JSON write interface. Opacity/immutable capture prevents ordinary caller editing. Adapter consistency checks cover Map identity, kind/prior relationship and revision numbering, not re-executing business commands. This is not an authentication mechanism.
- Full Revision state and Settlement introducedAtRevision follow the accepted history contract. The TypeScript draft distinguishes input Settlement from stored Settlement; the accepted final M1 specification has reconciled that distinction with the pure interface.
- One memory Adapter instance can store different MapIds with isolated state/history and separate Revision sequences. Each request commits exactly one Map; there are no cross-Map batch writes or atomic transactions. Same-ID creation returns map_already_exists; different-ID creation succeeds without changing existing Maps. Missing-ID reads/apply commits return map_not_found. Fresh instances are empty and do not share state; process restart retains nothing.
- Revision numbers are positive safe integers. Invalid read numbers are input errors, valid missing numbers are revision_not_found, and overflow rejects new changes rather than resetting/wrapping.

## Demo limits

Self-contained HTML; browser memory only, no backend, server, network, filesystem writes, or persistence. It uses an empty-Ticket Map and a miniature preparation function for creation/title replacement only. It does not implement the full runtime decoder, Ticket lifecycle, Claims, or Frontier transitions already explored in the command/workbench prototypes. Its history and revisions are synthetic, not reconstructed from the planning tracker.

The portable model is separate from the DOM shell. Its synchronous pure functions model a commit point; the shell invokes them through Promise-based operations to illustrate the proposed asynchronous port. A thrown simulation error is displayed by the shell, not returned as a StateAdapter domain result. The failure toggle is a prototype control, not a fourth production storage method.

Guided scenarios exercise concurrent creation, different-Map isolation through separate requests, prepared-writer races, pre-publication failure, detached historical reads, repeated prepared commit, and missing reads. No test suite is added. Syntax/pure execution checks do not imply a TypeScript type-check or browser UI validation.

## Human verdict

Corrected on 2026-09-17 after the user clarified that "Q9 不用" meant no multi-Map writes in one request, not a one-Map limit per storage instance. The earlier one-to-one binding and occupancy-error recommendation are withdrawn. Other accepted rules remain unchanged. This is an interface/state-model verdict, not browser click validation; production implementation remains separate.

The earlier capture commit `1ed3cfa25f1a46c92bb4828925175c504ad6e054` remains historical evidence and does not contain this correction. Current implementation must use the published specification and corrected source Answer, not restore the superseded occupancy rule. This focused correction does not modify Git state.

## Construction verification

Both HTML scripts parsed with Node. Pure-model execution checked non-mutating preparation, duplicate creation, authoritative commit conflict, pre-publication failure leaving both state/history unchanged, detached historical reads, and explicit missing results. Stripped TypeScript syntax parsed; no TypeScript type-check or agent-side browser UI verification was performed.

The original seven sequences and occupancy checks applied to the historical pre-correction artifact, not the corrected storage contract. Current verification is recorded separately after updating the model.

### Clarification verification

All seven corrected guided sequences ran through the portable model. Additional checks verified different-ID creation in one instance, separate Revision sequences and histories, commits leaving other Maps unchanged, duplicate-ID rejection, detached read/commit results, pre-publication failure leaving every stored Map unchanged, and fresh-instance emptiness. Portable IDs matching object-property names were also checked. HTML scripts and stripped TypeScript syntax parsed; this remains neither a TypeScript type-check, production conformance suite, nor browser UI verification. The historical capture reference was checked and remains unchanged.
