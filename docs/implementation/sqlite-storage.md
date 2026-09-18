# Private SQLite storage — Issue 34

Contract: [accepted MCP/SQLite handoff](../spec/mcp-sqlite.md), published at `5e48bb5174efd45cf3566505872efefa6e21aa11`. Implementation: [Issue 34](https://github.com/kun-g/wayfinder_map_service/issues/34). This is the first of six slices, not real MCP/Codex acceptance.

This document records slice 1's delivery. Slice 2 adds the storage-module backup operation, fault classifications and controlled process evidence; see [Issue 35 evidence and current operator behavior](sqlite-failure-backup.md). The historical results and remaining-work statements below describe the Issue 34 baseline, not a claim that slice 2 is still unimplemented.

## Operator interface and constraints

Use the separate `src/sqlite-storage.ts` entry point, not the pure `src/index.ts`. `initializeSQLite(path)` reserves a nonexistent target exclusively and initializes application ID `0x57464d31`, format version 1. Existing files, including empty files, are refused. `openSQLite(path)` uses SQLite URI `mode=rw`, recognizes that identity/version and compiles the format's ordinary queries without enumerating history. Missing or unsupported databases are not initialized, reset or migrated. An initialization failure may leave its fresh incomplete target; it is not silently removed or reused.

`openSQLite` returns `{ adapter, listMaps, close }`. StateAdapter still has exactly `readCurrent`, `readRevision`, `commit`; listing and connection lifetime belong to the storage module, not StateAdapter. `listMaps` defaults to 20, allows 1–100, uses ASCII Map-ID keyset pages, and returns null as the last-page cursor. No DB connection, SQL executor, import or test fault hook is exposed by the operator entry point.

Node.js is pinned to 26.3.0 in `.node-version`, package metadata and SQLite lifecycle checks. The accepted release-candidate risk remains unchanged. One synchronous connection verifies WAL, synchronous FULL and a 100 ms busy timeout. That timeout limits lock waiting, not whole-operation latency. Filesystem/configuration work is outside write transactions; no await or network work occurs inside them.

Production paths must be absolute, normalized, symlink-free, outside repositories/worktrees and temporary roots. The immediate application directory must be owned by the operator and mode 0700; DB and existing managed sidecars must be regular operator-owned files at 0600. New directories/files use those modes; unsafe existing state is rejected, not chmodded. System ancestors need not be0700, but must be root/operator-owned and not group/world writable without sticky protection. Ancestry is rechecked after directory creation and before DB reservation. Filesystem checks fail closed: macOS APFS/HFS through the native df type filter; Linux ext2/3/4, XFS or Btrfs through statfs. Other filesystems/platforms are refused. Linux execution and mounted network-volume rejection are not claimed as tested on this macOS host. The operator must still choose a genuinely local, unsynchronized disk location; filesystem type is not proof about an underlying network block device or cloud synchronization. The private directory assumes no adversarial same-UID replacement during filesystem checks/opening.

WAL/SHM/journal sidecars are managed storage, never explicitly deleted as caches by the module. SQLite may checkpoint/remove them on normal close. Tests alone use a non-operator-exported disposable-storage/fault seam and remove only their own isolated fixture directories. No canonical project database was created.

Every commit captures and freezes the input before yielding, checks envelope coherence, begins IMMEDIATE, and authoritatively checks absence/head. Full immutable Revision JSON and catalog/head publish together. Duplicate creation, missing Map and stale head are M1 structured results; storage errors are Promise failures, not fabricated Conflict. Failed pre-publication work rolls back; cleanup failure or unproven COMMIT outcome stops the connection and reports an unknown-outcome SQLiteFailure. No automatic retries/replays/merges. This slice's executable fault case is before COMMIT; detailed commit/cleanup/process faults belong to Issue 35.

## Verification, 2026-09-18

Actual host: Node 26.3.0, bundled SQLite 3.53.2, macOS local APFS. Commands: `npm test -- tests/sqlite-storage.test.ts` (41 tests passed), `npm run typecheck` (passed), `npm test` (1,102 tests in eight files passed). The original 1,061 M1 tests and compile-time public contract remain unchanged. New real-storage tests share behavior with the real memory Adapter, not a fake storage implementation. Memory's internal capture/Revision assembly now uses the same helper as SQLite; its behavior is unchanged.

| Contract case | Executable evidence |
| --- | --- |
| A01 | Strict typing and all original M1 regressions; new memory/SQLite conformance checks |
| D01 | Fresh initialization; existing empty/nonempty refusal; missing/empty/foreign/unsupported-version/schema opens refused unchanged |
| D02 | 0700/0600 creation; temporary/relative/repository production rejection; unsafe file/directory/ancestor modes; path and managed-sidecar symlinks; WAL and live sidecar privacy |
| D03 | Complete create record after reopen; all four typed Settlements, logical Claims, introduction revision, nested JSON and unrelated Maps |
| D04 | Promise.all contenders on two real connections, no prescribed winner: same-head apply and fresh duplicate creation each publish once; actual conflict head and independent Map writes |
| D05 | Invalid read numbers/IDs; missing commit Map; representative malformed/lifecycle/Claim/dependency/cycle/final-invariant/no-op rejects with complete current/history/proposed-next/unrelated comparisons |
| D06 | Injected failure after both transaction writes before COMMIT; full before/after/current/history/catalog comparisons and successful next commit |
| D08 | Malformed prepared envelopes; capture before caller mutation; frozen detached receipts/history |
| D09 | Single-query current state; stable pinned old revisions; exact receipt Frontier; coherent catalog fields/order/cursors and read-only listing |

Direct SQL in tests only configures foreign/unsupported formats or injects malformed JSON at the real infrastructure seam. Business assertions use StateAdapter/catalog reads. Malformed history JSON is not proactively scanned: opening and unaffected latest reads succeed; explicitly reading the malformed record raises an ordinary JSON parse error. No withdrawn-Q10 physical/semantic/history audit was introduced.

This does not prove busy/process-kill/cleanup-loss/backup cases (Issue 35), four MCP tools (36), HTTP/access lifecycle (37), real Codex/user verdict (38), or adoption (39). No live database, MCP configuration, rendered UI, rollback/deletion migration, or authority switch occurred.

Implementation facts checked against [pinned Node SQLite source](https://github.com/nodejs/node/blob/v26.3.0/src/node_sqlite.cc) (URI-open flag), [Apple df source](https://github.com/apple-oss-distributions/file_cmds/blob/main/df/df.c) (explicit type filtering), and [Linux filesystem magic definitions](https://github.com/torvalds/linux/blob/master/include/uapi/linux/magic.h). These links inform implementation, not alternative product authority.
