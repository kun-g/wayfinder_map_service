# Issue trackers: GitHub implementation and retained local planning

As of 2026-09-18, new M1 implementation work uses [GitHub Issues](https://github.com/kun-g/wayfinder_map_service/issues) in the private repository `kun-g/wayfinder_map_service`. The six approved implementation slices are published there. The existing M1 planning history and deferred rollback/deletion planning Maps remain local; they were not reopened or migrated.

## GitHub implementation workflow

1. Read the accepted [M1 handoff snapshot](../spec/m1.md), the issue body, and all native blockers. The original human-confirmed planning sources remain in `.scratch/m1-map-core-spec/`.
2. Query GitHub for current issue state, labels, assignees, and native `blocked_by` edges. A `ready-for-agent` issue is specified; it is startable only when all blockers are closed and nobody else holds it. Read-only inspection does not claim an issue.
3. Claim explicitly before implementation using the issue's assignee plus a concise session-identifying comment when needed. Preserve another session's claim; inspect stale claims before any reassignment. GitHub assignees are development workflow claims, not the product ClaimantId model.
4. Implement the approved vertical slice with its own tests and review. Link changes and actual verification results on the issue. Close only when all that slice's acceptance criteria pass; early planning issue closure is not evidence of feature delivery.
5. Keep dependency relationships native to GitHub and name blockers in the body for readability. Do not create duplicate local implementation tickets or alter completed parent planning issues. Fresh approval is required to change the accepted slice boundaries or migrate remaining planning Maps.

Approved slice order: creation/read → atomic Map revision → Ticket/Dependency/Frontier → two branches (Fog/Scope content; Claim), then Settlement/reopen after Claim. The whole M1 gate requires all six slices plus every branch of all 56 acceptance scenario groups, not just the final issue's tests.

User instruction (2026-09-18): do not monitor, wait for, or use CodeRabbit as an agent merge/review gate. Acceptance tests, strict type checking, Standards/Spec review, and conflict checks remain the quality gates. This does not authorize disabling the GitHub integration or bypassing repository-required checks.

The remote was initially published with the accepted M1 handoff snapshot. Agent configuration, project-local skills, provenance, license, domain documentation, and the v1 specification were synchronized on 2026-09-18. Existing `.scratch/` planning Maps and prototype captures remain in the original workspace and are not included in a fresh clone. Use `docs/spec/m1.md` as the complete published M1 implementation contract; follow retained local planning links only in a workspace that contains those sources. Preserve concurrent implementation work and stage only the files belonging to the current change.

## GitHub Project

The private [Wayfinder Map Service — M1 project](https://github.com/users/kun-g/projects/5) provides a board for `kun-g/wayfinder_map_service`. The six approved M1 issues are included. The default repository is `kun-g/wayfinder_map_service`; an enabled auto-add workflow includes new or updated repository Issues. PRs remain linked evidence rather than independent triage requests.

Issue closure moves the card to Done. Auto-close from card status is disabled: verify acceptance criteria and close the Issue explicitly. Native Issue state, assignees, and blocking relationships remain authoritative; the board is a development projection, not product Map state.

For CLI project reads, `gh` needs `read:project`; project mutations need `project`. Repository/Issue operations use the existing `repo` scope. If project scopes are unavailable, use the signed-in GitHub browser; do not broaden authentication scopes silently.

## Retained local planning

Use the operations below when resuming an existing `.scratch/` planning Map. Local Ticket mutation means a file edit, while GitHub issue mutation means a remote write. These are both development trackers, not the product Map StateAdapter.

### Layout

- `map.md`: Wayfinder map with Destination, Notes, Decisions so far, Not yet specified, and Out of scope.
- `spec.md`: the implementation specification produced after the decision route is clear.
- `issues/NN-name.md`: one decision ticket per file.

### Ticket fields

- `Type:` `research`, `prototype`, `grilling`, or `task`.
- `Status:` `open`, `claimed`, or `resolved`.
- `Blocked by:` comma-separated ticket numbers or empty.
- `Claimed by:` task or agent identity when claimed.
- `Claimed at:` timestamp when claimed.
- `Triage:` one value defined in `triage-labels.md` when triaged.
- `Category:` `bug` or `enhancement` when triaged.

### Wayfinding operations

- Create a map at `.scratch/<effort>/map.md` and tickets under `.scratch/<effort>/issues/`.
- The frontier is every `open`, unclaimed ticket whose `Blocked by` tickets are all `resolved`. For triaged tickets, include only `ready-for-agent`.
- Claim a ticket before work by updating `Status`, `Claimed by`, and `Claimed at`.
- Resolve a ticket only after its decision or required task is complete. Add an `Answer` section with evidence, set `Status: resolved`, and append a named summary link to the map's Decisions so far.
- Add newly visible tickets after resolution and keep still-fuzzy work in Not yet specified.
- Preserve another session's claim. A stale claim requires explicit inspection before reassignment.
- Local triage closes a rejected ticket by setting `Status: resolved` and recording the reason. `wontfix` records disposition, not implementation.

These retained local Wayfinding operations do not create remote issues, labels, comments, or pull requests. Use the GitHub implementation workflow above for the newly published implementation issues.
