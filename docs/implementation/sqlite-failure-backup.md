# SQLite restart, failures and manual backup — Issue 35

Contract: [accepted MCP/SQLite handoff](../spec/mcp-sqlite.md), sections 6, 8–11; [implementation Issue](https://github.com/kun-g/wayfinder_map_service/issues/35). Prerequisite: [private durable Adapter](https://github.com/kun-g/wayfinder_map_service/issues/34), delivered on baseline `dea201a1b25578240633b0aea165f2f700cd9cd2`. The exact reviewed implementation and normal merge commits are recorded in the Issue closeout. This is slice 2 only.

## Operator behavior

The separate storage entry point now returns `{ adapter, listMaps, backup, close }`; the pure entry point and three StateAdapter methods are unchanged. `storage.backup(destination)` is synchronous private maintenance, not a fifth MCP tool. One operator command builds the pinned TypeScript sources and runs it:

```sh
npm run --silent backup -- <absolute-source> <fresh-absolute-destination>
```

Use `--silent`: npm otherwise echoes the script and its private path arguments before application code runs. Nested build output is also silenced. Source storage must already exist and have the supported application/format identity. The normal private/local path policy applies to both paths, including repository/temp/symlink rejection, operator ownership and 0700/0600 permissions. Target, target sidecars and source DB/managed-sidecar targets are refused. Hardlinks are already-existing targets and cannot be overwritten. New target directories are private; the target file is reserved exclusively at 0600. Same-UID adversarial path replacement remains outside the inherited private-directory threat model.

Backup uses SQLite `VACUUM INTO` with a bound URI, not raw main-file copying. SQLite documents this as a consistent live-database backup alternative whose original logical content is unchanged; FULL synchronous mode syncs the output. This choice keeps the operation synchronous on the existing connection without a Worker, driver, retry loop or connection pool. No pruning/replay is introduced; complete logical Revision JSON remains present. See [SQLite VACUUM INTO](https://www.sqlite.org/lang_vacuum.html#vacuum_with_an_into_clause). Node's [backup API](https://nodejs.org/download/release/v26.3.0/docs/api/sqlite.html#sqlitebackupsourceDb-path-options) was also inspected; this implementation does not use its asynchronous threadpool backup job.

Success requires SQL completion, private path/mode checks and independent read-only application-format recognition/query compilation. These checks do not scan source or output history or perform an integrity audit. Errors leave any newly reserved/unconfirmed output for explicit inspection and never report it as a successful backup. Existing backups are never removed automatically. The command emits only fixed safe messages and nonzero failure status, never paths or raw causes. This is not restore/import, scheduled/cloud backup or a physical power-loss guarantee.

Commit Promise failures now expose `SQLiteFailure` with `code` (`storage_busy` for SQLite BUSY, otherwise `storage_failure`), `outcome` (`not_published` or `unknown`) and `requiresRestart`. M1 business rejections/Conflicts are unchanged. BEGIN IMMEDIATE contention respects the inherited 100 ms lock wait, publishes nothing and schedules no retry. Successful rollback allows the next explicitly requested operation. Failed cleanup stops every storage operation, including reads/catalog/backup, until reopen. An interrupted COMMIT/completion whose publication cannot be ruled out is unknown, never falsely unchanged. Error `cause` is internal diagnostic material and may be sensitive: future transport code must expose only safe fields, never serialize raw errors/causes.

Unknown receipt recovery is an authoritative reread of current/known history after reconnect; it does not automatically replay, retry, rebase or take over a Claim. Tests independently establish actual durable outcomes; absence of a receipt alone does not establish non-publication. Closing/reopening a storage host creates no Revision or implicit Claim release/reacquisition/expiry.

## Actual verification, 2026-09-18

Node 26.3.0, actual embedded SQLite **3.53.4**, macOS arm64/local APFS. Earlier Issue 34 research/verification recorded 3.53.2; that historical number is not substituted for this run. No MCP SDK, protocol or installed-client interoperability is exercised in this slice.

- `npm run typecheck`: passed, including existing compile-time public contracts.
- `npm test -- tests/sqlite-storage.test.ts tests/sqlite-failure-backup.test.ts`: 64 passed.
- `npm test`: 1,125 passed in nine files. All original 1,061 M1 tests remain; the Frontier algorithm/enumeration is not duplicated per Adapter.
- `npm run build`: passed (also executed by the child-host tests and maintenance command).
- `git diff --check`: passed.
- `WAYFINDER_MAINTENANCE_TEST_ROOT=<private-local-acceptance-root> node tests/helpers/sqlite-backup-smoke.mjs`: passed. Root was an explicitly scoped writable local directory outside repositories/tmp, not a canonical project DB. The script creates only a fresh named disposable fixture, runs the **actual** `npm run --silent backup` success/refusal paths while a source connection remains open, asserts both outputs omit source/target paths, independently compares known head/history/Claim, then removes only its own fixture. Private live paths are omitted from this report. Build first when reproducing it.

| Required evidence | Executable observations |
| --- | --- |
| D07 | Independent real SQL connection holds BEGIN IMMEDIATE; BUSY failure has bounded lock wait, distinct infrastructure code/no Conflict; complete known history/current/catalog/proposed-next/unrelated snapshots unchanged; no deferred retry after lock release; explicit next attempt succeeds |
| D06 / storage D11 | Pre-publication hook after catalog/history writes rolls back both; proven `not_published`, complete fixture comparison and next commit succeeds. Post-publication hook loses completion: `unknown`, connection stopped, reread proves Revision 4 and prior/unrelated history intact, Revision 5 absent |
| Storage D12 | Test-only rollback failure stops all DB operations, with no memory replacement; fresh connection sees exact unchanged head/history/catalog and no next Revision |
| Storage D10 | Actual child Adapter hosts close gracefully or are SIGKILLed while idle, after transactional writes/before COMMIT, and after COMMIT/before receipt; parent waits for explicit IPC boundary rather than sleeps; reopening/new host sees atomic results, full accepted history/Claim/Settlement metadata and no expiry/reacquisition/extra Revision |
| D13 success | Live WAL source backup independently opens with matching complete known Alpha/Other fixtures, every known Revision, Claim/Settlement introduction metadata and catalog; source unchanged and later source commit cannot change backup; URI-special filename and 0700/0600 tested |
| D13 refusal/failure | Active DB/absent managed-sidecar target, existing empty/nonempty/hardlink, symlink/dangling symlink, unsafe directory, orphan target sidecar and relative path refused unchanged; pre-work partial artifact, post-SQL completion fault and failed format recognition never return success; source known history unchanged, artifact retained and subsequent overwrite refused; command errors use safe fixed text/nonzero status |
| A01 | Strict TypeScript, all memory/pure M1 regressions and inherited real SQLite tests pass |

Only isolated named fixtures are faulted/removed. No pre-existing user data, canonical project database or older backup was removed. Process termination proves controlled Adapter-host behavior, **not** service HTTP shutdown/reconnect/transport response loss, client interoperability or hardware/power-loss durability. End-to-end D10–D12 still require the service/integration slices, P01–P09 and L01–L05 remain unperformed here. No withdrawn-Q10 history/proactive/per-read integrity audit, service startup/configuration, tool schema, authentication, workflow/skill change, migration or exploration authority switch.

## Review and closeout

Standards and Spec are reviewed independently against the pinned prerequisite merge baseline above; final reports, exact head/environment, conflict/check status, normal merge and post-merge verification belong to the Issue resolution. CodeRabbit is not an agent gate; repository-required checks are not bypassed. Close only after this scoped acceptance and normal merge, not as a claim that later HTTP/live acceptance or adoption is complete.
