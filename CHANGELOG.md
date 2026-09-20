# Changelog

All notable project changes are recorded here. Historical implementation evidence remains in `docs/implementation/` and is not rewritten into this log.

## Unreleased

### Workflow

- `2.0.0` (2026-09-20): change mandatory Conflict handling after a real ChatGPT acceptance attempt automatically resubmitted a stale intention at the reread head. A Conflict now voids that request; the client must reread, report the new Revision and stop until the human issues a new request after seeing it. The four tools, schemas and Map state semantics are unchanged.
- `1.2.0` (2026-09-20): make nested Reference, Provenance and Evidence object shapes explicit after the `1.1.0` diagnostic exposed a string-source mismatch. No Map tool, schema or state semantics changed.
- `1.1.0` (2026-09-20): add backward-compatible complete-command construction guidance after the first isolated Codex journey exposed partial validation probing. No Map tool, schema or state semantics changed.
- `1.0.0` (2026-09-19): publish the Wayfinder exploration workflow through MCP initialization instructions and locally sufficient descriptions for the four Map tools, with complete stable/versioned Resources and an optional side-effect-free Prompt. The contract is generated from `docs/agents/exploration-mcp.md`, remains immutable for one service process and removes repository-file or installed-Skill requirements from compatible clients.

### Architecture

- Record ADR 0003: the MCP service carries the independently versioned exploration workflow.
- Return expected structured domain outcomes such as Conflict, Rejected and Not Found without MCP `isError`, preventing ChatGPT from collapsing them into generic runtime exceptions; infrastructure and protocol failures remain errors.

### Documentation

- Add the accepted post-adoption self-contained workflow slice and its client-capability and repository-impact research.
- Align real-client acceptance with the exercised ChatGPT Desktop synchronized remote connector plus independent Codex CLI sessions; record the distinct persistent Codex-host configuration regression as not applicable rather than claiming it passed.
- Record the explicit live-human acceptance of workflow 2.0.0 and the final Grilling Settlement at Map Revision 8.
