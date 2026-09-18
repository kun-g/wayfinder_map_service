# Development planning Maps

Live planning is tracked in GitHub Issues. This file provides entry points rather than maintaining a second ticket-state list.

| Planning Destination | GitHub Map | Accepted specification |
| --- | --- | --- |
| Define a minimal local MCP/SQLite service and real Codex acceptance/adoption gate | [Codex MCP and SQLite acceptance planning](https://github.com/kun-g/wayfinder_map_service/issues/27) | [Accepted implementation handoff](../spec/mcp-sqlite.md), human-confirmed 2026-09-18; service/acceptance not delivered |
| Define the post-M1 Revision rollback contract | [Revision rollback planning](https://github.com/kun-g/wayfinder_map_service/issues/12) | Not yet accepted; publish as `docs/spec/rollback.md` after explicit human confirmation |
| Define post-M1 Ticket and permanent Map deletion contracts | [Ticket and Map deletion planning](https://github.com/kun-g/wayfinder_map_service/issues/17) | Not yet accepted; publish as `docs/spec/deletion.md` after explicit human confirmation |

Each parent Issue has native sub-issues and native blocker edges. Query GitHub for current open/closed state and assignees; file contents are not a live progress mirror. All nine rollback/deletion child Questions were migrated open and unassigned on 2026-09-18, without settling proposals or starting implementation.

The local MCP/SQLite effort inherits M1 and plans new exploration-Map adoption only after real acceptance. GitHub remains the bootstrap planning and implementation tracker; existing rollback/deletion Maps are not automatically migrated or dual-written.

These Maps plan development decisions. Rollback updates an existing product Map with a new immutable Revision; creating a planning parent Issue does not initialize or clone a product Map.

Read [the tracker workflow](../agents/issue-tracker.md) before querying or changing a Map. The accepted M1 foundation is [docs/spec/m1.md](../spec/m1.md); its original decisions and prototypes are preserved in [the frozen M1 planning archive](../archive/m1-planning/README.md). Deletion recommendations in the archived Ticket 07 remain unconfirmed. Accepted rollback baseline decisions in Ticket 06 are inherited rather than reopened without cause.
