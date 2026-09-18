# M1 Map Core Implementation Specification

Status: archived planning, complete and human-confirmed on 2026-09-17. This effort produced the specification, not production implementation.

Current M1 implementation requirements: [published accepted specification](../../spec/m1.md). Progress, claims and blockers: [GitHub Issues](https://github.com/kun-g/wayfinder_map_service/issues). This Map retains decision provenance; its resolved Tickets do not assert implementation delivery. See [planning status index](../../planning/README.md).

## Destination

Produce an implementation-ready specification for M1: the pure Map domain module, an in-memory state Adapter, and executable acceptance tests covering Frontier calculation, immutable Revision history, and conflicts.

The specification must be precise enough for a separate implementation session to proceed without reopening product or domain decisions.

## Notes

- This effort plans M1 and carries specification synthesis through to `docs/spec/m1.md`; it does not implement production code.
- Use the domain language in `CONTEXT.md` and treat `docs/spec/v1.md` as the product contract.
- Consult `docs/adr/0001-remote-map-is-authoritative.md` and `docs/adr/0002-mcp-tools-are-the-primary-interface.md` when defining authority and public seams.
- Use `grilling` and `domain-modeling` for semantic decisions. Use `prototype` when a concrete TypeScript interface is needed to judge behavior.
- Target TypeScript on Node.js, strict type checking, ESM, and Vitest.
- Lock domain types, commands, results, errors, ports, and acceptance scenarios. Keep directory layout and reversible internal algorithms advisory.
- Include minimal Claim semantics in M1; defer authentication, claim leases, and multi-user collaboration policy.
- One apply operation may atomically commit a command batch against one expected prior Revision. Any command failure rejects the entire batch.
- Preserve immutable Revision history and Settlement introduction context in M1. Rollback implementation belongs to [Revision rollback planning](https://github.com/kun-g/wayfinder_map_service/issues/12), a separate post-M1 effort that consumes this effort's Revision contract.
- Decision Ticket deletion and permanent Map deletion are deferred to [Ticket and Map deletion planning](https://github.com/kun-g/wayfinder_map_service/issues/17). M1 has no deletion commands, Adapter ports, or deletion tests; the 30-day recovery period also remains outside M1.

## Decisions so far

- [Define the Map aggregate boundary](issues/01-define-map-aggregate-boundary.md): M1 keeps one deterministic current-state Aggregate with first-class Wayfinder content, while history, tenancy, sharing, and service concerns remain outside it.
- [Define the Decision Ticket lifecycle and settlement model](issues/02-define-decision-ticket-lifecycle.md): Tickets move only between open and settled, with one typed Settlement and explicit reopen semantics preserving prior results solely through Revision history.
- [Define Dependency and Frontier invariants](issues/03-define-dependency-and-frontier-invariants.md): Same-Map acyclic AND Dependencies gate settlement; explicit atomic reopening preserves downstream validity, and Frontier is a canonicalized, unstored set of eligible unclaimed Tickets.
- [Define Claim semantics](issues/04-define-claim-semantics.md): Work-session Claims enforce exclusive Ticket handling and matched edits/settlement, with explicit release or reasoned manual clear but no leases or per-session quota.
- [Prototype the atomic command and conflict contract](issues/05-prototype-command-and-conflict-contract.md): Pure ordered preparation and final graph validation precede authoritative atomic commit; explicit input, rejection, conflict, no-op, and retry defaults are locked by the accepted prototype.
- [Define immutable Revision and history semantics](issues/06-define-revision-and-rollback-semantics.md): Full immutable state and ordered semantic summaries preserve history and original Settlement context; rollback is separately planned after M1.
- [Prototype the state Adapter contract](issues/08-prototype-state-adapter-contract.md): Three asynchronous operations address independently stored Maps; each request commits one Map atomically with detached reads and explicit absence, duplicate-ID and conflict results. Q9's single-instance restriction was corrected after clarification.
- [Define the executable M1 acceptance contract](issues/09-define-acceptance-contract.md): Public-interface scenarios, bounded small-graph enumeration, competing commits, failure atomicity, and nested isolation establish a strict type-check/test/traceability gate.
- [Synthesize the M1 implementation specification](issues/10-synthesize-implementation-spec.md): The human-confirmed implementation handoff reconciles the contracts and supplies concrete acceptance traceability; the planning Destination is reached.

## Not yet specified

None known after specification synthesis and explicit human confirmation. All child Tickets are resolved; the deletion Ticket remains a scope disposition rather than an accepted deletion contract. Any new implementation-blocking ambiguity must be surfaced rather than silently changing this accepted specification.

## Handoff

- [Accepted M1 implementation specification](spec.md): the implementation entry point, including mandatory acceptance case IDs and scope exclusions.
- [Accepted acceptance-family matrix](acceptance-matrix.md): source-family overview, expanded into concrete cases in the specification.
- Planning is complete. Production implementation, strict type-checking, and formal M1 acceptance execution were not performed by this effort and must not be inferred from its Ticket resolutions.

## Out of scope

- PostgreSQL, migrations, network transport, OAuth, machine credentials, authorization scopes, and audit logging.
- Browser or MCP Apps rendering, share links, exports, recovery bundles, backups, and deployment.
- Packaging the adapted skills or plugin, end-to-end client validation, and production operations.
- Claim leases, automatic stale-claim detection or recovery policy, invitations, and collaborative editing; explicit human-directed Claim clearing is included in M1.
- Rollback commands, restoration behavior, and rollback acceptance tests: see [Revision rollback planning](https://github.com/kun-g/wayfinder_map_service/issues/12). This is a later feature of the same product Map, not product Map cloning.
- [Define Decision Ticket and Map deletion semantics](issues/07-define-deletion-semantics.md): moved out of M1 at the user's request; continued in [Ticket and Map deletion planning](https://github.com/kun-g/wayfinder_map_service/issues/17). The proposed deletion gates were not accepted and remain open there.

## Demo

- [M1 planning workbench](prototypes/map-workbench.prototype.html): disposable read-only tracker projection plus an in-memory exploration sandbox. The projection reflects completed local planning; it does not track current GitHub implementation work. Browser writes stay in the sandbox.
- [State Adapter commitment model](prototypes/state-adapter.prototype.html): corrected disposable interface reference, demonstrating separately stored Maps with one-Map requests, races, historical reads, and pre-publication failure; the earlier Git capture predates the correction.
