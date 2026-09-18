# M1 planning workbench — throwaway prototype

Status: historical prototype projecting completed M1 planning. It is frozen as a review artifact; current implementation work is tracked in GitHub Issues and governed by [docs/spec/m1.md](../../../spec/m1.md).

Open `map-workbench.prototype.html` directly in a browser. No server, installation, framework, network, or persistence is used.

The prototype asks whether the accepted Ticket, Dependency, Frontier, Claim, and atomic command rules make sense while inspecting the completed M1 planning graph. It is not the M1 production renderer or Adapter, and it is not the authoritative local tracker.

## Use

- The default view is a read-only static projection of `.scratch/m1-map-core-spec/map.md` and its in-scope local tickets. The deletion ticket was moved out of M1 and is shown as a Scope Exclusion, not fabricated as an accepted Settlement. The settled statements are compact summaries, not substitutes for the source Answers.
- Copy the projection to the sandbox for experimentation, or choose the small example. Changes live only in browser memory. Refreshing or reloading a fixture discards them.
- Select a node to inspect its Question, prerequisites, Settlement, and raw ClaimantId. Destination is visibly separate from dependency nodes.
- Free-play controls use the same pure module as the guided scenarios. Advanced commands are an ordered array with one expected Revision; preparation failure rejects the entire array.
- Demo Revision starts at 1 and counts sandbox commits. It is synthetic, not history reconstructed from Markdown tracker mutations.
- If a tracker claim is seeded, it is projected as `fixture-codex-session`, explicitly synthetic. It is not a genuine product ClaimantId, and `Codex /root` is not claimed to be one. The synchronized projection has all nine in-scope planning Tickets settled, an empty Frontier and no active tracker Claim. Ticket 07 remains a scope disposition and is excluded from the graph.
- Claim has no independent ClaimId. Alpha/Beta display labels are separate from their raw work-session IDs.
- Rollback and Ticket/Map deletion are deferred to separate later planning efforts, outside current M1. Both controls remain disabled, not promises to enable them when an M1 ticket closes.

## Historical static projection

The `<script id="planner-seed" type="application/json">` block is the single synchronization marker. The 2026-09-18 cleanup synchronized it to completed planning, including `syncedAt`, status and statement summaries. Preserve that planning snapshot; query GitHub Issues for current implementation progress. A reopened browser page reads the embedded seed, not live Markdown or GitHub state.

The seed is deliberately a projection schema, not an import schema for the product. ClaimantId and Settlement source metadata in fixtures are synthetic. Full source Answers remain authoritative.

## Supported surface and limits

Supported: Map title/Destination/Notes replacement; Ticket creation and open-field replacement; Dependencies; acquire/release/manual clear and explicit handoff; typed Settlement; explicit reopen; runtime validation; input/command/final-state rejection; expected-Revision conflict; no-net-change rejection.

Extensions and Evidence/Reference/Provenance are accepted through supported JSON commands and visible in complete state. Fog and Scope Exclusions are seeded and shown but have no content command controls. Unknown or unsupported commands and core fields are rejected. This intentionally incomplete prototype is not a conformance implementation of the full reference TypeScript interface.

The pure module produces `prepared`, not durable success. The page simulates one synchronous in-memory writer. It does not establish authoritative concurrent CAS, full Revision history, system-derived Settlement introducedAtRevision, deletion, rollback, authentication, authorization, or sharing. These omissions do not remove the accepted M1 history and introduction-context requirements.

The original construction used script syntax and pure-module checks; it did not establish production conformance or browser UI acceptance. The 2026-09-18 cleanup changes historical metadata and projection status only; it does not assert a new human prototype verdict or production acceptance.
