# Matt Pocock skill provenance

This repository vendors eight project-local skills derived from [`mattpocock/skills`](https://github.com/mattpocock/skills) at commit `3cca18b368ae95cdbdebbff572ccafa662551015`.

Installed skills:

- `setup-matt-pocock-skills`
- `wayfinder`
- `grill-with-docs`
- `grilling`
- `domain-modeling`
- `prototype`
- `research`
- `triage`

The files were copied from the already verified project-local snapshot in `tomorrow-supply-station`. That snapshot was fetched from the fixed upstream commit and contains no business rules from the source project. `docs/agents/skill-sources.json` records each upstream source; `docs/agents/installed-skill-hashes.json` records the expected SHA-256 hashes. The upstream MIT license is preserved at `THIRD_PARTY_LICENSES/Matt-Pocock-MIT.txt`.

The repository adds host metadata under each skill's `agents/openai.yaml`. This metadata came from the user's current OpenAI-compatible installation and controls display names and invocation policy. The `triage` frontmatter drops the legacy `disable-model-invocation` key; its equivalent explicit-only policy lives in `triage/agents/openai.yaml`. Issue 39 adds a repository-owned `wayfinder` workflow overlay that points new exploration to `docs/agents/exploration-mcp.md` while preserving GitHub for implementation and the two inherited planning Maps. These overlays are recorded in `skill-sources.json` and reflected in the installed hashes.

The repository-local copies are the runtime dependency. Global skills under a user's home directory are irrelevant to reproducibility and may differ.

When upgrading:

1. Select and record an explicit upstream commit.
2. Fetch into a temporary location and compare semantics before replacing files.
3. Preserve this repository's product decisions in `docs/spec/v1.md` and `AGENTS.md` rather than patching upstream skill instructions silently.
4. Update `skill-sources.json`, installed hashes, and the license when applicable.
5. Validate every installed skill and run a real Wayfinder/Grilling workflow before accepting the upgrade.
