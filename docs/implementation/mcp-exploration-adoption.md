# 新探索 Map 的 MCP 工作流采用——Issue 39

范围：[采用 MCP 推进新探索 Map](https://github.com/kun-g/wayfinder_map_service/issues/39)，以及[已接受的本地 MCP/SQLite 交接规范](../spec/mcp-sqlite.md)第 1、12–13 节。原生依赖 Issue 38 已在记录 L05 真人接受后关闭；本次会话随后检查无人领取并完成领取。

状态：新探索工作流更新、完整回归及真实 installed-Codex 跨会话采用证明均已通过。实现 Issue/PR 仍由 GitHub 管理；既有 rollback/deletion 规划 Map 未迁移、未双写。新探索 Map 的 Destination、Ticket、Dependency、Claim、Settlement、Fog 与 Scope 由产品 MCP 单独持有。

## 工作流变更

[新探索 MCP 工作流](../agents/exploration-mcp.md)成为项目级权威引用，规定以下行为：

- 创建前分页检查目录，选择并保留稳定 Map ID；标题只用于发现，不能作为权威句柄。
- 恢复时优先使用已保留 ID，否则通过目录发现后默认读取当前 Revision。
- 只对当前 Frontier 中的 Ticket 获取 Claim；成功提交 Claim 后才开始工作。
- 使用服务返回的 Revision 作为下一次 `expectedRevision`，以单个有序批次提交 Settlement 及同一决议产生的新 Ticket、Dependency、Fog/Scope 变化。
- `grilling`/`prototype` 保留真人裁决门禁；`research`/`task` 只在方法实际完成后写入类型匹配的 Settlement 和 Provenance。
- Conflict 或结果未知时先重读再明确决定；不自动重放、合并或接管。服务不可用时暂停，不使用内存、文件或 GitHub 作为后备权威。

项目本地 [wayfinder skill](../../.agents/skills/wayfinder/SKILL.md)通过一个明确指针加载该工作流，并把创建、恢复、Claim 和原子推进步骤映射到四个 MCP 工具。`AGENTS.md` 与 GitHub tracker 文档区分产品 Map 权威和开发协调权威。既有 rollback/deletion Map 继续使用原生 GitHub 父子 Issue 和依赖关系。

## 自动化验证

实际执行：

```sh
npm run typecheck
npm test
npm run build
node --check tests/helpers/codex-wayfinder-adoption.mjs
git diff --check
WAYFINDER_ADOPTION_TEST_ROOT=<private-local-root> \
WAYFINDER_ADOPTION_TEST_PORT=43139 \
WAYFINDER_ADOPTION_REPORT=<fresh-report-target> \
node tests/helpers/codex-wayfinder-adoption.mjs
WAYFINDER_CODEX_TEST_ROOT=<private-local-root> \
WAYFINDER_CODEX_TEST_PORT=43142 \
WAYFINDER_CODEX_REPORT=<fresh-regression-report-target> \
node tests/helpers/codex-live-acceptance.mjs
```

严格 TypeScript、构建、脚本语法和 diff 检查通过。完整套件 **11 个文件 / 1,167 项测试**通过，保留全部 M1 与 MCP/SQLite 验收覆盖；抽取共享 harness 后再次完整重跑通过。沙箱内首次完整测试因回环地址 `listen EPERM` 产生 19 个 HTTP 失败、其余 1,148 项通过；允许回环后的完整重跑全部通过，该沙箱结果不作为通过证据。

真实采用运行使用仓库、worktree 和临时目录之外的全新私有根目录、0700 根目录、随机环境令牌、固定回环端口和进程局部 Codex MCP 配置。永久 MCP 设置保持不变；运行结束后服务优雅停止且只清理本次夹具。发布证据不含令牌、私有路径或 SQL。

运行器的首个试运行使用系统临时根目录，在任何 Map 写入前被生产路径校验正确拒绝。第二个试运行完成全部真实会话，但最终观察器错误地把 `readCurrent` 状态当作 Revision 包装层，因而未发布报告；夹具已清理。修正观察路径后的试运行通过。双轴审查进一步指出 outage 探针没有实际断言后备操作为零；现从 Codex JSONL 的已完成操作计算并拒绝任何非消息操作。两个 installed-Codex 运行器共用[仅测试 harness](../../tests/helpers/codex-mcp-harness.mjs)，集中服务生命周期、进程局部配置、结构化结果校验和私密信息检查。最终证据来自共享 harness 上的全新数据库完整重跑；原有 Issue 38 运行器也用全新夹具回归 **44 次原生调用**并通过 L01–L04 断言。旧运行器的 L05 输出仍指它自身不能产生真人裁决；Issue 38 的真人裁决已单独记录在[验收报告](mcp-sqlite-acceptance.md)中。

## 真实 adopted-workflow 证据

[机器可读证据](mcp-exploration-adoption-evidence.json)记录 **15 次真实原生 MCP 调用**和一次必需服务不可用探针，运行检出提交 `891fa18649ffcd98f61192e77fb63ad596bd904a`（基于 Issue 38 的正常合并提交 `467d452870b1313e695eccd98d2a1ec8d49f3d83`），codex-cli **0.153.0**、Node **26.3.0**、SQLite **3.53.4**、SDK **1.30.0**、协商协议 **2025-06-18**。运行时 skill SHA-256 为 `301d8e9615e9f6b25108ee93e73ed790c65ec8bd08003731001dde362101d63b`。

新 Map 的稳定 ID 为 `Adoption.NewExploration.20260919`：

| Revision/阶段 | 观察结果 |
| --- | --- |
| 1 | 会话 A 在空目录检查后创建新探索 Map。 |
| 2 | A 在一个有序批次中创建 `SourceReview` research Ticket、依赖它的 `Synthesis` task Ticket、Dependency、Fog 和既有 Map 迁移 Scope Exclusion。 |
| 3 | A 以 `adoption:A` 成功 Claim `SourceReview`，之后才执行研究推进。 |
| 4 | A 写入带 Accepted Spec Reference/Provenance 的 Finding，并在同一批次移除已澄清 Fog；Frontier 返回 `Synthesis`。 |
| 5 | 无 A 对话或 Map ID 的独立会话 B 先调用目录，以精确标题发现并保留同一稳定 ID，默认读取 Revision 4，再以不同 Claimant `adoption:B` Claim `Synthesis`。 |
| 6 | B 写入 Completion，并默认读取相同 Map 的最终状态；没有创建替代 Map，也没有改写 A 的 Settlement。 |
| Conflict | 恢复的 A 仅以缓存的 Revision 4 发出一次陈旧写入，收到 expected 4/current 6 Conflict；随后重读 Revision 6 并明确放弃陈旧意图，没有重试、合并、接管或 Revision 7。 |
| Outage | 服务停止期间，新会话因必需 MCP 权威不可用而以非零状态停止，MCP 调用和后备操作均为 0。服务恢复后，独立会话 C 通过目录重发现并只读确认 Revision 6、两项 Settlement 与不存在的 Revision 7。 |

三条独立 thread 分别为 `01a0b758-dc82-7b01-b2a8-7cc1bb113404`、`01a0b759-55c7-7fb3-a7f9-69c453c52653` 和 `01a0b759-f250-70f2-aada-1713b5f89845`；冲突重读恢复第一条 logical session。完整参数、结果、状态及最终观察保存在 JSON 证据中，Agent 最终文字本身不作为证明。

## 权威边界

本次没有修改 M1 领域、SQLite Adapter、MCP 工具/服务契约、依赖、永久 MCP 配置或旧 Map 数据。GitHub 继续保存实现 Issue/PR 和两个既有规划 Map；新探索 Map 不再把 GitHub、文件或对话当作当前状态源。服务不可用时工作流暂停，恢复后从产品 MCP 重读。
