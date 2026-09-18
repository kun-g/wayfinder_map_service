# Codex MCP and SQLite runtime findings

Date: 2026-09-18. Status: researched facts and recommendations, not an accepted implementation specification.

Research Ticket: [[MCP planning] Research Codex connection and SQLite runtime constraints](https://github.com/kun-g/wayfinder_map_service/issues/28). Parent: [[Planning Map] Codex MCP and SQLite acceptance](https://github.com/kun-g/wayfinder_map_service/issues/27).

## Confirmed boundaries

This slice uses SQLite, connects Codex first, and gives all work sessions the same service-managed database. It preserves M1 domain behavior. New exploration Maps use the product MCP only after real acceptance; implementation Issues/PRs stay in GitHub. Existing rollback/deletion planning Maps are not migrated. ChatGPT integration, public deployment, OAuth, rendering, sharing, export and Recovery Bundle import are excluded. These are human-confirmed parent-Map boundaries, not conclusions of this research.

## Existing repository and local runtime

Inspected repository baseline: `522d9b96b6c8a8224a7071576ff8e3c2f953874b`.

- [package.json](../../package.json) contains only `typecheck` and `test` scripts, with no runtime dependencies, MCP SDK, server command or SQLite driver. It pins `@types/node` 26.6.1, TypeScript 7.0.2 and Vitest 5.0.1; Node type declarations do not pin the executing runtime. No tracked `.node-version`, `.nvmrc`, `.tool-versions` or GitHub runtime workflow exists at this baseline.
- Read-only local commands returned Node **26.3.0**, npm **11.16.0**, platform **darwin/arm64**, and `process.versions.sqlite` **3.53.2**. These observations describe this host, not every future Codex launcher or CI environment. No database was opened or created.
- [src/index.ts](../../src/index.ts) exports the pure preparation/validation/Frontier functions and memory Adapter. [StateAdapter](../../src/memory-adapter.ts) has exactly `readCurrent`, `readRevision` and `commit`. Each fresh memory Adapter has independent empty storage.
- [Accepted M1 sections 7–8](../spec/m1.md) require immutable full-state Revision records, authoritative CAS at commit, atomic head/history publication, exact committed-result return, detached outputs and ordinary conflict/rejection data. Unexpected infrastructure failures reject the Promise. There is no list/search, import, automatic merge/retry or idempotency cache. SQLite must not change the memory Adapter's independence contract; persistent-instance expectations need separate acceptance cases.
- Claims identify logical work sessions, not MCP connections or authenticated users. A service reconnect must not invent automatic Claim expiry/takeover. [CONTEXT](../../CONTEXT.md) and [M1](../spec/m1.md) remain authoritative.

## Official Codex connection facts

Official OpenAI documentation supports command-launched **STDIO** and address-based **Streamable HTTP** servers on local Codex hosts. MCP configuration lives in user `config.toml` or trusted-project `.codex/config.toml`; local clients on the same Codex host share it. STDIO accepts command/args/environment/cwd; HTTP accepts URL and optional authentication headers. Defaults are 10 seconds for startup and 60 seconds for tool execution. Server instructions can describe cross-tool constraints. This establishes configuration options, not that this service is installed or connected. No user configuration, credentials or account scopes were inspected or changed. The documentation does not establish this installed client's precise supported protocol revisions; actual interoperability must be demonstrated. [Official OpenAI MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

## Current MCP protocol and SDK facts

### Version/lifecycle compatibility

The official TypeScript SDK README identifies **v2 as the stable line**, targeting MCP **2026-07-28**. Its packages are split into `@modelcontextprotocol/server` and `@modelcontextprotocol/client`; schemas support Standard Schema-compatible libraries. v1 remains bug/security maintained for at least six months after v2 release. Read-only GitHub API inspection found the server 2.0.0 release, published 2026-07-27T23:55:41Z. This is upstream publication evidence, not a dependency installation test. [Immutable README](https://github.com/modelcontextprotocol/typescript-sdk/blob/60321700871029401a2e3bed8fdf4f02c9ec3331/README.md), [server release](https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/%40modelcontextprotocol/server%402.0.0)

At that upstream commit, the server package declares ESM and Node `>=20`; local Node 26.3.0 satisfies the declared engine range. An engine range alone does not prove application/type compatibility. [Immutable package metadata](https://github.com/modelcontextprotocol/typescript-sdk/blob/60321700871029401a2e3bed8fdf4f02c9ec3331/packages/server/package.json)

Modern 2026-07-28 MCP uses per-request version/capability metadata, without an initialization handshake; 2025-11-25 and earlier use `initialize`. Modern-only servers cannot serve legacy-only clients. Dual-era servers may serve both. Consequently, treating a protocol session as a Map identity or Claimant is unsound regardless of transport. [Versioning and compatibility specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)

The v2 SDK has documented legacy support: `serveStdio` defaults to serving legacy clients, while `createMcpHandler` defaults to per-request stateless legacy fallback. Legacy HTTP GET/DELETE session operations are not provided by that fallback; sessionful legacy deployments require additional routing. Select compatibility deliberately and test the actual Codex host, rather than assuming a modern-only example is sufficient. [SDK legacy-client guide](https://ts.sdk.modelcontextprotocol.io/v2/serving/legacy-clients.html)

### Transport options, not a settled choice

| Option | Verified transport behavior | Implication for this slice (inference) |
| --- | --- | --- |
| Direct STDIO | Client launches a subprocess; protocol uses newline-delimited JSON-RPC on stdin/stdout. Logs may use stderr, never stdout. EOF is graceful shutdown; forced termination/restart is possible. | Smallest network-free Codex path. Separate client processes can still share one canonical SQLite file, but this is **not** one shared application process. Requires cross-process persistence/CAS acceptance and a stable absolute DB path. |
| Loopback Streamable HTTP | Server is an independent process handling multiple clients. Modern protocol uses POST with JSON or request-scoped SSE, not the old GET notification stream/protocol sessions. Local servers should bind loopback; Origin validation is required and authentication recommended. | Closest to a single service process owning the DB; requires explicit startup/reconnect and local endpoint safety policies. Loopback alone is not access control. |
| STDIO bridge to shared service | Custom composition, not a new domain seam. | Adds process/handoff complexity; no evidence that it is necessary for Codex-first acceptance. Do not add it without a demonstrated requirement. |

Sources: [STDIO specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio), [Streamable HTTP specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http). Both options preserve client-neutral Map semantics; neither changes the wider [remote-authority ADR](../adr/0001-remote-map-is-authoritative.md). Local acceptance is not completion of the always-on remote product.

### Tool results, schema and errors

Tools advertise input schemas and may advertise output schemas; server structured output must conform when an output schema is provided. Structured results should also have serialized JSON text for backwards compatibility. Protocol errors cover unknown tools/malformed protocol requests; actionable tool execution errors, including input/business errors, use `isError: true`. Tool inputs require validation. These rules do not choose the Wayfinder tool names or result union: that contract remains a human design decision. Existing M1 paths/codes, `expectedRevision` and conflict data should survive wrapping rather than become unstructured prose. [Tools specification](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)

## SQLite runtime and driver options

Node 26.3.0's built-in `node:sqlite` is **Stability 1.2 — release candidate**, not fully stable. `DatabaseSync` executes synchronously and represents one connection; a file path provides file storage, unlike `:memory:`. The busy `timeout` option defaults to zero. Prepared statements support bound parameters and affected-row counts. This path needs no third-party SQLite native-addon dependency, but synchronous work/busy waiting can block the application event loop and runtime/version pinning matters. Promise-shaped Adapter methods do not make synchronous SQLite asynchronous. [Exact local-version Node SQLite documentation](https://nodejs.org/download/release/v26.3.0/docs/api/sqlite.html)

`better-sqlite3` is a maintained alternative with synchronous APIs and transactions, requiring a currently supported Node version; upstream offers prebuilt binaries on major platforms/architectures. That is not evidence that every specific Node/OS/architecture combination has a usable binary. It introduces an addon/dependency packaging check not performed here. [Driver README](https://github.com/WiseLibs/better-sqlite3)

Its transaction helpers do not work with async callbacks: an early `await` ends the synchronous callback before subsequent work. Infrastructure errors can also cause SQLite to roll back unexpectedly. A transaction must not silently continue after an error. [Driver transaction documentation](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)

Recommendation, not selection: evaluate built-in `node:sqlite` first for this small local slice if the user accepts its release-candidate status. Otherwise choose a pinned supported driver/runtime after explicit installation compatibility checks. Do not install both merely to keep options open. Exact versions, build/start scripts and CI/runtime pinning belong in the implementation handoff.

## SQLite transactions, CAS and restart durability

SQLite permits multiple read transactions but one simultaneous writer. `BEGIN IMMEDIATE` obtains a write transaction before the first write and can return `SQLITE_BUSY`; deferred read→write upgrade may also fail. `COMMIT` can return busy while leaving the transaction active. Some errors may roll back a statement or the whole transaction, so cleanup must account for actual transaction state. [Transaction specification](https://www.sqlite.org/lang_transaction.html)

Ordinary separate SQLite connections do not see uncommitted writes. WAL provides snapshot reads; trying to upgrade an obsolete snapshot to a writer can return `SQLITE_BUSY_SNAPSHOT`. `BEGIN IMMEDIATE` avoids that particular upgrade pattern by reserving the write transaction first. [SQLite isolation](https://www.sqlite.org/isolation.html)

A configured busy handler waits only up to its budget, then reports busy. Lock contention is not itself evidence that a Map's expected head is stale. Do not convert every busy exception into an M1 Conflict or silently resubmit business commands. [Busy timeout API](https://www.sqlite.org/c3ref/busy_timeout.html)

WAL permits concurrent readers/writer but only one writer, and requires all participating processes on one host, not network filesystems. The WAL file is part of persistent state; detaching/deleting it can lose committed transactions. Long read transactions can delay checkpoint progress. The official WAL-reset corruption bug was fixed in SQLite 3.51.3 and later (with named older backports). This host reports 3.53.2; future packaged runtimes/drivers must independently establish a fixed engine. [SQLite WAL documentation](https://www.sqlite.org/wal.html)

Durability settings are not interchangeable: WAL with `synchronous=FULL` includes per-commit synchronization and is ACID; WAL/NORMAL may lose recent commits after power/system failure while preserving application-crash durability. SQLite exposes an application-managed `user_version`, but does not perform migrations for the application. Journal/connection settings should be explicitly verified, not assumed from defaults. [SQLite PRAGMAs](https://www.sqlite.org/pragma.html#pragma_synchronous), [application version field](https://www.sqlite.org/pragma.html#pragma_user_version)

Atomic commit/recovery relies on filesystem, locking and synchronization assumptions; documentation is not proof that arbitrary storage or hardware honors them. Scope restart/process-crash acceptance separately from a claim of tested power-loss resilience. [SQLite atomic commit assumptions](https://www.sqlite.org/atomiccommit.html)

### Proposed storage pattern (inference/recommendation)

The existing M1 seam can support SQLite without serializing PreparedCommit as a public import format:

1. Capture/detach the internal prepared envelope before asynchronous yield and retain its defensive coherence checks.
2. In one short explicit write transaction, establish Map absence for create or compare the authoritative head to `priorRevision` for apply. A conditional head update with a checked affected-row count is one CAS option; transaction-reserved read/check/update is another. Database uniqueness constraints guard duplicate Map IDs and `(MapId, Revision)`.
3. Insert the full immutable Revision and publish its head together. Roll back the whole transaction on a known pre-commit failure, without overwriting previous history. Commit only once.
4. Return the exact captured committed Revision and derive its Frontier; do not reread a newer head to manufacture success.

Keep SQL/driver exceptions out of the pure domain. Head mismatch with a known actual head is Conflict; contention, disk-full, corrupt/unreadable storage and an unobserved reply are infrastructure/transport problems. A commit may become durable before a client loses its response: reread before deciding what to do, rather than claiming every failed call published nothing or adding an unapproved automatic retry/idempotency layer.

Recommend one explicit private absolute DB path outside disposable worktrees, `:memory:` and repository-controlled content; no caller-selected DB path or arbitrary SQL tool. Initialization/migration should verify an application schema/version, create a fresh schema transactionally, and refuse unsupported newer versions or incoherent persisted data rather than silently reset. The exact path, initialization consent, schema representation, validation/loading boundary, migration strategy and local safety policy are **not settled** by this research.

## Acceptance evidence still required

Research checked official documentation, immutable upstream package metadata/releases, local runtime metadata and existing public seams. It did not install dependencies, start a server, mutate settings, open a DB, run transport tools, simulate crashes or claim real acceptance.

The later acceptance plan should include:

- Actual Codex connection, discovery/tool schemas/results/errors and recorded client/server/protocol versions.
- The full create→Dependency→Claim→Settlement→Frontier→historical read M1 flow over real tools, not prototype state.
- Fresh-DB initialization versus reopening an existing DB, preserved head/history/Settlement introduction metadata and Claims after graceful restart, process termination and reconnect.
- Two independent sessions/connections reading the same Map; same-head competing writers and duplicate create with exactly one publication, immutable prior history and exact success results.
- Known pre-publication failure and busy timeout separately from possible post-commit response loss; no implicit retry, merge, takeover or state reset.
- Unrelated-Map isolation, runtime validation, unsupported schema/corrupt data refusal, configured DB/sidecar persistence, local access boundaries and non-content logging.

## Decisions left to the human/next Tickets

Transport (direct STDIO/shared file versus one loopback service), process lifecycle, installed-client protocol compatibility target, minimal public tool/result schemas, metadata authorship/Claimant handling, runtime/driver RC acceptance, DB path/bootstrap/migrations, journal/durability/busy budgets, local access control and error/uncertain-outcome policy remain open. Recommendations above are inputs to those decisions, not an accepted ADR or implementation authorization.
