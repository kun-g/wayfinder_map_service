# Wayfinder Map Service agent instructions

Start by reading `README.md`, `CONTEXT.md`, and `docs/spec/v1.md`. Read relevant files under `docs/adr/` before changing architecture or product semantics.

The current delivery slice is M1: the pure Map domain module, an in-memory state Adapter, and acceptance tests for frontier calculation, immutable revision history, and conflicts. Rollback and deletion are separate post-M1 iterations: read `.scratch/revision-rollback/map.md` when planning rollback, or `.scratch/map-deletion/map.md` when planning Ticket/Map deletion; both reference the M1 foundation. Keep deployment, OAuth, PostgreSQL, rendering, and plugin packaging outside M1 unless the user changes the scope.

Use the domain language in `CONTEXT.md`. Record a newly settled domain term there. Add an ADR only for a hard-to-reverse, surprising trade-off with meaningful alternatives.

## Agent skills

### Issue tracker

New M1 implementation tickets use GitHub Issues in `kun-g/wayfinder_map_service`; existing planning Maps remain under `.scratch/<effort>/`. Read `docs/agents/issue-tracker.md` before querying or mutating either tracker. For M1 implementation, read the published accepted handoff in `docs/spec/m1.md`. The private M1 Project board and synchronization rules are documented in `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles use GitHub labels or the local planning ticket's `Triage:` field; see `docs/agents/triage-labels.md`.

### Domain docs

Single context: `CONTEXT.md` and `docs/adr/`; see `docs/agents/domain.md`.

### Matt Pocock workflows

Project-local skills live in `.agents/skills/`: `setup-matt-pocock-skills`, `wayfinder`, `grill-with-docs`, `grilling`, `domain-modeling`, `prototype`, `research`, and `triage`.

Invoke `wayfinder` for work that spans more than one agent session, `prototype` for a disposable artifact that answers a design question, `domain-modeling` when changing the glossary or recording an ADR, and `grilling` when a human decision genuinely blocks progress. Use skills as methods, while `docs/spec/v1.md` remains the product contract.

GitHub Issues coordinate new M1 implementation work; `.scratch/` retains the existing planning decisions and deferred planning Maps. Both are development trackers, separate from the product-level Wayfinder Map state system being built.

Skill provenance, upstream commit, license, and installed hashes live in `docs/agents/skills-provenance.md`, `docs/agents/skill-sources.json`, `docs/agents/installed-skill-hashes.json`, and `THIRD_PARTY_LICENSES/`.
