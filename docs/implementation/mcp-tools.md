# Four headless MCP tools — Issue 36

Scope: [Implement four headless Map MCP tools](https://github.com/kun-g/wayfinder_map_service/issues/36), accepted [local handoff](../spec/mcp-sqlite.md) sections 3–6/9 and P01–P05. Native blocker 34 was closed before claim. Development Issue/PR records are not product Map state.

## Implementation and environment

Implementation baseline/review fixed point: `298088e02fdc67a7dcd119d3eb2fa97e00777bee` (main after Issue 35). Runtime exercised on 2026-09-18: Node.js 26.3.0, npm 11.16.0, macOS arm64, embedded SQLite **3.53.4** (queried from node:sqlite; the handoff's 3.53.2 is historical research, not this run). Runtime SDK is pinned to `@modelcontextprotocol/sdk` 1.30.0; `package-lock.json` pins installed transitive dependencies (including Zod 4.6.5 and AJV 8.20.0). Direct dev AJV 8.20.0 validates published schemas independently in tests. SDK protocol negotiation exercises `2025-11-25`; client is the SDK `Client`, named `wayfinder-protocol-test`, version 0.1.0, not installed Codex.

`src/mcp-tools.ts` exposes `createMapMcpServer(storage, configuration)` returning an **unconnected** SDK Server. The host supplies already-open operator-managed SQLite storage and validated operator actor/client IDs; the tool supplies server time. Configuration is captured, not mutable caller authorship. The advanced Server API intentionally retains M1 validation fields instead of high-level SDK text-only validation errors or duplicate-text convenience output. `src/index.ts` remains pure and has no SDK/storage re-export.

The later lifecycle slice must supply authenticated loopback Streamable HTTP, request/admission limits, readiness and shutdown. This module does not open files, choose caller paths, authenticate, close storage on conversation disconnect, or register any transport/STDIO bridge. It implements the Issue's 100-command limit only at the tool boundary; pure M1 remains unlimited by that outer-service policy.

Exactly four advertised tools have input/output JSON schemas, unknown-field rejection and unchanged M1 command shapes. Creation translates public mapId to core id; preparation validates the full batch before storage observation/semantics. Writes call the real authoritative SQLite commit and return its captured Revision/Frontier or compact receipt, never a later head reread. Current reads pin observed head N, fetch immutable N and derive Frontier from that same state. Catalog pages use the existing SQLite ASCII keyset implementation.

Every business payload occurs once in structuredContent with empty content. Known input/command/final-state/not-found/conflict results preserve applicable M1 fields as ordinary tool results without `isError`, because real ChatGPT otherwise collapses their structured payload into a generic runtime exception. Output schemas still declare every structured branch. Unknown tools return JSON-RPC InvalidParams. Malformed tools/call request shapes return the pinned SDK's JSON-RPC InternalError (request schema parsing); neither becomes a domain rejection. Unsupported MCP task execution is rejected before mutation. Infrastructure mapping alone sets `isError: true` and exposes only kind/code/outcome/requiresRestart, never exception messages, causes or stacks. Generic failures remain unknown and require restart; SQLiteFailure preserves the Adapter's proven non-publication versus unknown classification. There is no retry, memory fallback or replay.

## Executable evidence

Disposable clearly named `wayfinder-mcp-tools-acceptance-*` storage and SDK-linked in-process transports exercise the **real protocol handler, M1 and SQLite**, not a Demo. Controlled wrappers around the real Adapter force exact publication/read boundaries without timing races. They are test-only and not public tools or a second production driver. Known rejection cases compare complete current state, all fixture history, proposed-next absence and unrelated Maps. Post-publication faults instead reopen storage and verify actual durable outcome; they do not assert false non-publication.

| Gate | Assertions in `tests/mcp-tools.test.ts` | Outcome |
| --- | --- | --- |
| P01 | Exactly four schemas; public IDs, safe Revisions, nested typed Settlement/Evidence/Reference/Provenance/JSON, all M1 commands; unknown/system/import fields and forged authors rejected; full-shape-before-semantics; 100/excess command boundary with pure-M1 101-command control | Pass |
| P02 | Omitted/false compact versus true snapshot create/apply, exact captured receipt/full Revision/Frontier during subsequent publication, all four typed Settlements, once-only structured results, detached output | Pass |
| P03/D09 | Current versus pinned history, immutable Claims and Settlement introduction, explicit reopen reasons, absent Map/revision, positive-safe input errors, current N coherence during later writes | Pass |
| P04 | Empty catalog, repeated titles, ASCII order, default 20, limits 1/100, invalid boundaries, nonexistent lexical cursor, more/end cursor, coherent changed title/Destination/head | Pass |
| P05/D05 | Input paths and commandIndex; lifecycle/Claim/dependency/invariant/no-op failures; duplicate create, stale and losing publication conflicts; complete non-effects; unknown/malformed protocol errors; real busy/pre-publication/closed/unknown failures and safe diagnostics | Pass |
| A01/regression | Existing M1 pure/memory suite and compile fixtures unchanged; existing SQLite suites retained | Pass |

Actual commands: `npm run typecheck`, `npm run build`, `npm test`, `git diff --check`, `npm ls @modelcontextprotocol/sdk ajv zod --all`, `npm audit --omit=dev`. Strict type checking/build/diff checks pass; all 10 test files and 1,142 tests pass, including 17 tool scenario groups. This count is reported as an outcome, not a substitute for the branch assertions above. Installation and runtime audit reported zero vulnerabilities; no pending optional fsevents install script was approved or required for passing verification.

## Independent two-axis review

Reviewed implementation commit `0c0911091e17ef719e142efef8435f47bd28ab49` with `git diff 298088e02fdc67a7dcd119d3eb2fa97e00777bee...HEAD`, in two separate read-only agents using the code-review method. Subsequent changes only record this evidence. Normal merge/required-check/conflict evidence and final commit are recorded on [PR 42](https://github.com/kun-g/wayfinder_map_service/pull/42) and the Issue. CodeRabbit is not a gate; repository-required checks still apply.

### Standards

0 findings: no documented-standard violations or actionable baseline smells. Pure entry point unchanged; schemas/orchestration separated; existing validation and authoritative publication boundary retained; captured configuration and detached outputs; safe diagnostics; real SQLite test seams and scope/authority boundaries respected. Tooling-enforced checks were excluded from this axis.

### Spec

0 actionable findings against Issue 36 and handoff sections 3–6/9/11/13. Four handlers retain unchanged M1 semantics, whole-shape validation, server authorship, captured writes/current-history/catalog, declared variants and once-only structured results. P01–P05 and applicable D05/D09 are exercised without claiming HTTP/Codex/adoption delivery. Independent reviewer also ran `npm test -- tests/mcp-tools.test.ts`: 17 scenarios passed.

## Explicitly not delivered

P06–P09 HTTP/access/lifecycle and end-to-end D10–D12 service tests are not run/delivered here. SDK-linked protocol tests are **not HTTP integration or installed Codex acceptance**. L01–L05 and the live human acceptance/adoption gate remain not-run. There is no runnable server, MCP settings change, canonical project database creation, live credentials, migration, dual-write, deployment, recovery/import, renderer, or exploration workflow modification. New exploration Maps do not change authority merely because these handler tests pass; existing rollback/deletion planning Maps stay in GitHub.
