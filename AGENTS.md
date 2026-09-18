# Wayfinder Map Service agent instructions

Start by reading `README.md`, `CONTEXT.md`, and `docs/spec/v1.md`. Read relevant files under `docs/adr/` before changing architecture or product semantics.

The current delivery slice is M1: the pure Map domain module, an in-memory state Adapter, and acceptance tests for frontier calculation, immutable revision history, and conflicts. Rollback and deletion are separate post-M1 iterations: read `docs/planning/README.md` for their GitHub planning Maps and inherited M1 foundation before resuming either effort. Keep deployment, OAuth, PostgreSQL, rendering, and plugin packaging outside M1 unless the user changes the scope.

Use the domain language in `CONTEXT.md`. Record a newly settled domain term there. Add an ADR only for a hard-to-reverse, surprising trade-off with meaningful alternatives.

## Agent skills

### Issue tracker

Implementation and active planning use GitHub Issues in `kun-g/wayfinder_map_service`. Read `docs/agents/issue-tracker.md` before querying or mutating the tracker. For M1 implementation, read the published accepted handoff in `docs/spec/m1.md`. The private M1 Project board and synchronization rules are documented in `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles use GitHub labels; see `docs/agents/triage-labels.md`.

### Domain docs

Single context: `CONTEXT.md` and `docs/adr/`; see `docs/agents/domain.md`.

### Matt Pocock workflows

Project-local skills live in `.agents/skills/`: `setup-matt-pocock-skills`, `wayfinder`, `grill-with-docs`, `grilling`, `domain-modeling`, `prototype`, `research`, and `triage`.

Invoke `wayfinder` for work that spans more than one agent session, `prototype` for a disposable artifact that answers a design question, `domain-modeling` when changing the glossary or recording an ADR, and `grilling` when a human decision genuinely blocks progress. Use skills as methods, while `docs/spec/v1.md` remains the product contract.

GitHub Issues coordinate implementation and active planning. Completed planning decisions and prototypes are frozen under `docs/archive/`; accepted specifications live in `docs/spec/`. These development records are separate from the product-level Wayfinder Map state system being built.

Skill provenance, upstream commit, license, and installed hashes live in `docs/agents/skills-provenance.md`, `docs/agents/skill-sources.json`, `docs/agents/installed-skill-hashes.json`, and `THIRD_PARTY_LICENSES/`.
