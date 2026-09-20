# MCP self-contained workflow acceptance

Status: accepted. Workflow 2.0.0 automated and cross-client gates passed through ChatGPT Desktop's synchronized remote connector and independent Codex CLI sessions; the live human explicitly accepted the evidence on 2026-09-20.

Issue: [#46](https://github.com/kun-g/wayfinder_map_service/issues/46). Accepted contract: [MCP/SQLite section 14](../spec/mcp-sqlite.md#14-post-adoption-self-contained-workflow-publication) and [ADR 0003](../adr/0003-mcp-service-carries-the-versioned-exploration-workflow.md). Planning authority: product Map `Wayfinder.McpSelfContained`, settled at Revision 12.

## Delivered contract

- `docs/agents/exploration-mcp.md` is the sole authored workflow source and declares `workflowVersion: 2.0.0`.
- The initialization instructions begin with a complete safety core no longer than 512 characters. The version and concise method summary follow it.
- The descriptions of exactly `map_create`, `map_list`, `map_read` and `map_apply` are generated from named source blocks.
- `wayfinder://workflow/exploration` and `wayfinder://workflow/exploration/2.0.0` return the complete authoritative Markdown as `text/markdown`.
- `start_wayfinder_exploration` supports `create` and `resume`, with an optional stable Map ID, and performs no storage operation.
- The generated TypeScript asset is ignored by Git, compiled into `dist` and is the process-lifetime runtime contract. Runtime code does not read the repository workflow path.
- Fixed readiness output includes `workflowVersion=2.0.0`. The root `CHANGELOG.md` owns project and Workflow release history.
- A Conflict voids the rejected request. The client must reread, report the new Revision and stop until the human issues a new request after seeing it; the stale instruction cannot pre-authorize a later write.
- The optional project-local `wayfinder` Skill is now an invocation/method adapter and does not require a repository-relative workflow file.

## Automated evidence

Environment on 2026-09-20: Node.js 26.3.0, embedded SQLite 3.53.2, MCP TypeScript SDK 1.30.0, protocol fixture 2025-11-25. The working tree was based on `e6b2b2c816efcc9d439ea48fcac9643c99656458`; this report does not describe that base commit as containing the uncommitted implementation.

| Gate | Result |
| --- | --- |
| Deterministic extraction, exact 2.0.0 SemVer, named-block/order/tool-set/safety-bound refusals, changed-workflow version increase, and Conflict wait-for-human language | Pass |
| Strict TypeScript check | Pass |
| Build from generated source to `dist` | Pass |
| In-process SDK initialization, four generated tools, Resources, Prompt branches and zero Prompt storage effects | Pass |
| Real Streamable HTTP initialization, instructions, Resources and Prompt | Pass |
| Domain outcomes remain structured without MCP `isError`; infrastructure failures retain `isError` | Pass |
| Reconnect/restart retains the same process contract and persisted Map state | Pass |
| Fixed safe readiness version | Pass |
| Existing domain, SQLite, failure, backup, security, admission, shutdown and HTTP regression suite | Pass |

Commands completed successfully:

```text
npm run --silent build
npm run --silent typecheck
npm test
```

Vitest result: 12 files passed, 1,171 tests passed. Machine-readable status is in [mcp-self-contained-workflow-evidence.json](mcp-self-contained-workflow-evidence.json).

## Real-client gate

The workflow 1.2.0 journey was run against a fresh private database without injecting the Skill, `AGENTS.md`, repository workflow Markdown or copied safety text. ChatGPT Web created two Maps because the MCP display name changed; `self-contained-cross-client-acceptance-1.3` is the selected journey and the first Map remains preserved. Independent Codex sessions successfully claimed and settled its Research and Task Tickets. At Revision 6 the HITL Grilling Ticket was the sole Frontier item.

The intentional stale request correctly conflicted when it supplied Revision 2. ChatGPT reread Revision 6, but then automatically reapplied the old notes intention and committed Revision 7 with `notes = "stale-intent-probe"`. The Conflict therefore did not satisfy the acceptance gate. Revision 7 and both databases are retained as failure evidence; no rollback or manual repair converts this journey into a pass.

This observation changed mandatory client behavior and therefore advanced workflow SemVer from 1.2.0 to 2.0.0. The fresh 2.0.0 journey used Map `self-contained-cross-client-acceptance-2.0`:

1. ChatGPT Desktop, using the account-synchronized remote Wayfinder-Save connector also visible on the web surface, paged the empty catalog, created the Map once and atomically published three ordered Tickets, two Dependencies, one Fog item and one Scope Exclusion at Revision 2. It incorrectly reported the workflow version as `M1`; direct initialization evidence proves the service supplied `workflowVersion: 2.0.0`, so this is retained as inaccurate client prose rather than server state.
2. An independent installed Codex CLI session default-read Revision 2, claimed the Research Ticket at Revision 3 and settled it with a Finding at Revision 4. Its first complete Settlement used an incorrect nested Finding shape and was safely rejected without a Revision before its autonomous correction.
3. A second independent Codex session default-read Revision 4, claimed the Task at Revision 5 and settled it with a Completion at Revision 6. Its first complete Settlement used an array for `resultingFacts` and was safely rejected without a Revision before its autonomous correction. Both rejected attempts remain evidence; they are not hidden or counted as Revisions.
4. ChatGPT intentionally submitted Revision 2 against head 6, reread Revision 6 and stopped without replay. The first run exposed that ChatGPT collapsed a structured Conflict carrying `isError: true` into `INVALID_ARGUMENT / RuntimeException`; the Map remained unchanged. After explicit human approval, expected domain outcomes were moved out of the MCP error channel. The same stale request then returned the full structured Conflict (`expectedRevision: 2`, `currentRevision: 6`) and again stopped with no write.
5. The service was gracefully stopped, consistently backed up, rebuilt and restarted against the same database. Revision 6, its contiguous Revision 1–6 history, both Settlements and the sole HITL Frontier Ticket remained exact. The Grilling Ticket remains open and unclaimed.
6. The protocol surface directly exposes initialization instructions at 2.0.0, both stable/versioned Resources and the optional Prompt. ChatGPT Desktop's synchronized remote connector and installed Codex do not document those optional surfaces to the model and are recorded as `undocumented`, not as supported. The browser surface was not separately repeated because the user reports the same connector and conversation are synchronized. The user explicitly removed the distinct persistent Codex-host configuration regression from this slice on 2026-09-20; it is recorded as not applicable, not passed.

The live human considered the two safely rejected Settlement-shape attempts and ChatGPT's inaccurate initial version prose alongside the successful authority, Claim, persistence and post-fix Conflict behavior, then explicitly returned `通过`. The Map recorded the human Claim at Revision 7 and the Grilling Decision Settlement at Revision 8; all three Tickets are settled and Frontier is empty.

## Human verdict

Accepted on 2026-09-20. The verdict accepts workflow 2.0.0 while retaining every failed attempt and the documented non-blocking observations. It does not claim separate browser sampling, persistent Codex-host configuration, automatic client exposure of Resources/Prompts, production deployment, OAuth or plugin marketplace packaging.

The prior adoption and MCP/SQLite reports remain historical and unchanged. README and release-completion claims remain gated on the explicit live-human acceptance verdict.
