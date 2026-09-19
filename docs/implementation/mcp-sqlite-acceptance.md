# MCP/SQLite 集成与已安装 Codex 验收——Issue 38

范围：[完成自动化集成与真实 Codex 验收](https://github.com/kun-g/wayfinder_map_service/issues/38)，以及[已接受的交接规范](../spec/mcp-sqlite.md)第 11–12 节。原生依赖 Issue 37 已关闭，且本 Issue 在[本次会话领取](https://github.com/kun-g/wayfinder_map_service/issues/38#issuecomment-5731318196)前无人负责。本报告记录第 5 个交付切片的证据；是否采纳探索工作仍由单独设有门禁的 Issue 39 决定。

状态：自动化门禁、独立 Standards/Spec 双轴审查以及完整的已安装 Codex **L01–L04 均已通过**。**L05 正等待真人现场裁决。在取得该裁决且所有必需门禁通过前，Issue 38 必须保持打开状态，本变更也不得以“验收完成”的名义合并。**

## 确切环境与隔离设置

服务代码基线：`1b8d89f277870e24d4b959f1c2cae6c59c218eff`（服务 PR 43 的正常合并提交）。完整运行记录的检出提交为 `2c9f196c7f252f2d76efa85550312f0f5a5190a7`，其中已审查的运行器包含下述 Spec 修正。Issue 38 仅修改测试、证据和 README；服务、领域、依赖、传输及结果契约均未改变。审查固定点为服务合并基线。最终证据/审查提交以及正常合并属于 Issue/PR 收尾流程，因此本文不写入自我引用的提交标识符。

2026-09-18 的实际主机环境：macOS arm64/本地 APFS，Node **26.3.0**、npm **11.16.0**、通过 node:sqlite 查询的内嵌 SQLite **3.53.4**。SDK **1.30.0**、Zod **4.6.5**、AJV **8.20.0**；现有锁文件固定了已安装的传递依赖版本。自动化协议客户端使用 SDK Client/StreamableHTTPClientTransport，协商版本为 **2025-11-25**。实际安装的客户端为 **codex-cli 0.153.0**，通过其原生 MCP 客户端调用；成功的初始连接探针协商版本为 **2025-06-18**。完整运行证据分别记录实际协商结果；未添加兼容桥或重复的 JSON 文本。

所有失败、集成及备份夹具都是全新、具名、用后即弃的验收 Map/数据库。单元测试和集成测试中的故障使用现有的仅测试临时存储接缝。生产入口冒烟测试和已安装 Codex 测试使用仓库、worktree 及临时目录之外明确新建的私有本地目录，并执行操作者路径校验；目录权限为 0700、数据库权限为 0600，令牌仅通过随机环境变量提供，并显式配置固定的回环端口。优雅停止后只删除本次运行自己的夹具。本报告及发布证据均省略私有路径和凭据。

可选启用的[已安装 Codex 运行器](../../tests/helpers/codex-live-acceptance.mjs)会启动真实、独立的 `dist/mcp-start.js` 前台进程。Codex 接收进程局部的 `-c` HTTP 配置并使用 `bearer_token_env_var`；`--ignore-user-config` 保持永久 MCP 设置不变，并排除其他已配置服务器。其只读沙箱保持启用。临时批准只适用于四个已获授权的隔离验收工具，使用[官方 MCP 配置](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)。运行器验证没有发生 shell、浏览器、其他工具或委派操作。两个会话分别独立创建，未 fork，也未互相提供对方的对话。[被动、仅测试观察器](../../tests/helpers/codex-acceptance-observer.mjs)只记录 initialize 响应中的协议版本；它既不处理或更改请求，也不增加服务器端点或传输层。

这是与实际安装的 **CLI** 之间的互操作性验收，不是桌面 UI 或 ChatGPT 验收。Codex JSONL 将结果键投影为 `content`/`structured_content`，并通过失败调用状态表达工具错误；该投影不会保留线上的 `isError` 字段。自动化协议/HTTP 测试另行断言原始 `isError` 信封及输出 schema。结构化业务载荷保持唯一，无需文本后备即可消费。

## 命令与结果

实际执行的命令如下（私有根目录值已隐去；它们是操作者环境值，不是公开配置或凭据）：

```sh
npm run typecheck
npm test
npm run build
npm test -- tests/mcp-service.test.ts
npm test -- tests/sqlite-storage.test.ts
git diff --check
npm ls @modelcontextprotocol/sdk ajv zod --all
node --check tests/helpers/codex-live-acceptance.mjs
node --input-type=module -e 'import { DatabaseSync } from "node:sqlite"; const db=new DatabaseSync(":memory:"); console.log(db.prepare("select sqlite_version() as version").get()); db.close();'
WAYFINDER_MAINTENANCE_TEST_ROOT=<private-local-acceptance-root> node tests/helpers/sqlite-backup-smoke.mjs
WAYFINDER_SERVICE_TEST_ROOT=<private-local-acceptance-root> node tests/helpers/mcp-service-smoke.mjs
WAYFINDER_CODEX_TEST_ROOT=<private-local-acceptance-root> WAYFINDER_CODEX_TEST_PORT=43138 WAYFINDER_CODEX_REPORT=<fresh-local-report-target> node tests/helpers/codex-live-acceptance.mjs
```

严格检查、构建、diff 检查及两个真实操作者冒烟命令均通过。当前完整测试套件：**11 个文件 / 1,167 项测试**，其中包括未变更的原始 **1,061 项 M1 测试**、45 个存储用例和 20 个 HTTP 场景用例。这些数量用于描述结果，而不是定义验收门禁：下表每一行都把必需分支观察映射到可执行断言。编译夹具和全部 56 个 M1 分组仍可在[累计 M1 矩阵](m1-acceptance.md)中追溯；不会按 Adapter 重复纯 Frontier 枚举。

第一次受限沙箱运行因回环地址 `listen EPERM` 导致 14 个 HTTP 用例失败（1,143 项通过）；这不属于通过证据。允许回环地址后的重跑已通过。新测试开发阶段曾错误地预期可空的 Settlement 和对象形式的 Claim 字段；断言已修正为已接受的 M1 形状，即缺省 Settlement 和字符串 Claim，并完成重跑。第一次 Codex 探针已完成初始化，但其默认的 never 批准策略拒绝了工具调用；随后只修改了进程局部的隔离工具批准设置。后续 A 试运行完成了全部 15 次调用；B 虚构了 `op`/`claimant` 字段，并在 `commands[0].kind` 处被正确拒绝。完整运行使用全新夹具，并向 B 提供已接受的 M1 命令形状，但没有向其提供 A 的 Map ID 或对话。另一次试运行完成了 A/B 两套工作流，但记录器错误地预期 B 的默认紧凑回执包含 Revision 对象；该断言已修正，结果契约未改变。一次可选启动尝试没有暴露任何工具，也没有执行调用或写入；现在验收服务器为必需项，且必须在会话开始前完成初始化。这些都是如实记录的试运行失败，不是完整的 L01–L04 证据，也没有自动重放任何结果不确定的写入。

## 完整自动化可追溯性

文件缩写：S = [sqlite-storage.test.ts](../../tests/sqlite-storage.test.ts)，F = [sqlite-failure-backup.test.ts](../../tests/sqlite-failure-backup.test.ts)，T = [mcp-tools.test.ts](../../tests/mcp-tools.test.ts)，H = [mcp-service.test.ts](../../tests/mcp-service.test.ts)。测试名称包含契约 ID。详细断言及继承的交付切片证据见[存储](sqlite-storage.md)、[失败/备份](sqlite-failure-backup.md)、[工具](mcp-tools.md)和[服务](local-mcp-service.md)；下表记录当前累计执行范围。

| 门禁 | 可执行分支/断言 |
| --- | --- |
| A01 | 严格 TypeScript/公开编译夹具；保留全部 56 个 M1 分组及原始纯领域/内存场景。H 新增 grilling/prototype/research/task 的完整真实 HTTP 工作流，未改变 M1，也未复制命令逻辑。 |
| D01 | S：显式初始化全新存储/空目录，保持对现有空文件和非空文件的拒绝；打开时拒绝缺失、空、外来、不支持版本或 schema 的存储，且不替换原文件。操作者服务冒烟测试还覆盖错误 SQLite 字节和命令就绪拒绝。 |
| D02 | S：新建文件使用私有权限模式；拒绝相对路径、临时目录和仓库路径，以及不安全的目录、文件、祖先目录、符号链接文件/目录/sidecar，并验证在线 WAL sidecar 的私密权限。新增只读探测，检查 initialize/open 时实际 Adapter 连接均观察到 WAL/FULL/100 ms。针对真实自有夹具模拟进程 UID 不匹配；拒绝后字节、head、全部已知历史及无关 Map 均不变，也不创建目标。未声称执行特权 chown 或跨用户文件系统变更。 |
| D03 | S/T：完整覆盖 create 以及四种类型化 Settlement/Claim/introducedAtRevision/author/change/嵌套 JSON 的往返，独立 Map 序列、重新打开及不可变旧记录。H 现也通过 HTTP 覆盖全部四种结果。 |
| D04 | S：两个真实连接在相同 head 上竞争 apply，以及重复 create 竞争；均恰好发布一次，并返回实际失败方 head/重复错误码。独立 Map 均可成功，较早的完整历史保持不变。T：通过工具覆盖以第二个权威 head 为准的发布竞争。 |
| D05 | S/T/H 加 M1 矩阵：覆盖合法/畸形 ID、revision、未知/系统字段，先检查整体形状再检查语义，以及 Map/历史缺失、生命周期、类型、Claim、Dependency、环、最终不变量、no-op、陈旧写入等分支，并保留适用的 path/stage/index/ID。共享的[拒绝矩阵](../../tests/helpers/mcp-rejection-cases.ts)通过真实 SQLite 工具和 HTTP 运行全部 15 个 M1 命令错误码、全部三个可达图最终错误以及 no-op，包括每种已 Settlement 的变更/Claim 命令、缺失/错误/重复 Claim、真实类型不匹配、重复/缺失边或内容，以及未 Settlement 的命令位置错误。当前状态、全部已知历史、无关 Map 及提议的下一 Revision 均无副作用；H 还包含不完整 reopen 和独立客户端陈旧写入。防御性的悬空 current G08 仍在 M1 公开准备夹具中；合法工具无法生成或导入悬空图。 |
| D06 | S/F：两项事务写入完成后、COMMIT 前发生故障时，历史、目录和 head 一并回滚；完整已知夹具比较通过，下一次显式提交可成功。 |
| D07 | F/T/H：独立真实 SQL 写入锁产生有界 BUSY 诊断，而不是 Conflict；不会发布或延迟重试，已知状态/历史/无关夹具不变；释放锁后显式发起的后续请求成功。 |
| D08 | S 的真实内存/SQLite 一致性测试：畸形内部 identity/kind/prior/next 信封会使 Promise 失败；输入在 yield 前捕获。覆盖嵌套 create/request/调用方提供的 current/内部 prepared 变更，以及对已冻结 prepared/receipt/current/history 的变更尝试，范围包括 Map/Ticket/Settlement/Evidence 扩展、Content/Settlement/Evidence References、Provenance sources 和 Completion resultingFacts。精确的已接受记录以及更早/无关历史均保持不变。 |
| D09 | S/T：连贯的目录分页及已观察 current N；后续提交推进时，固定的历史 N/Frontier 保持不变；紧凑/快照提交回执均精确指向 N。旧历史稳定，缺失的指定 revision 不会回退到 latest。 |
| D10 | F/H：使用 IPC 控制优雅、空闲、COMMIT 前和 COMMIT 后的终止边界，不依赖 sleep，也不预设赢家。真实 HTTP SIGTERM 排空已接纳工作并拒绝新请求；SIGKILL 保持原子结果；重连/重启保留精确 head、全部已知历史、Claim 和引入元数据，不产生额外 Revision、过期或接管。 |
| D11 | F/T/H：覆盖“已提交但完成信号丢失”、服务在线时 HTTP 响应中止，以及 COMMIT 后回执前 SIGKILL；持久化结果独立断言，在重新读取前回执仍属未知，不重放，也不错误声称状态未变。另有对先前状态、无关状态、下下次状态的比较及刻意触发的陈旧 Conflict。 |
| D12 | F/H：发布前故障加清理失败后，read/catalog/create/apply/backup 均停止，直至重启；不会继续变更或回退到内存。全新存储实例恢复精确已知结果，之后显式操作成功。 |
| D13 | F/操作者备份冒烟：在线 WAL 一致性备份可独立打开，包含全部已知状态、历史、Claim 和元数据，源库不变；源库之后的提交不能改变备份。活动数据库/sidecar、现有空或非空目标、硬链接、符号链接、悬空链接、不安全目标、孤立目标及相对目标均被拒绝且保持不变。开始前、完成后及完成格式故障均不会把部分产物报告为成功；仍拒绝覆盖全新目标，并提供安全的命令诊断和非零退出码。 |
| P01 | T：恰好四个匹配的 schema，完整覆盖实际 M1 命令联合类型/嵌套校验，并拒绝未知字段、系统字段、author、path、SQL 和 import。没有复制 Demo 逻辑，也未增加公开存储/工具端口。H 通过真实 HTTP 运行完整联合类型的四种类型化结果。 |
| P02 | T/H：一次且仅一次的结构化载荷、`content []`，验证紧凑默认/false 及显式完整变体符合输出 schema；后续推进后仍固定在精确的已提交 N/Frontier。紧凑结果不重复回执、文本或图。 |
| P03 | T/H：区分 current 与显式请求的完整历史，使用服务返回的 expected head，提供不同的 invalid/missing/conflict 错误码；读取历史 Claim/Settlement 不会恢复状态；没有“全部历史”工具。 |
| P04 | S/T/H：覆盖空值、默认值、1 和 100 的 limit；拒绝 0、101、小数及非数字；ASCII 区分大小写的键集排序；不存在的 cursor 边界；有更多页/末页 cursor；字段连贯且允许重名。独立 HTTP 目录续页使用稳定 ID。 |
| P05 | T/H：参数/业务工具错误保留 path/stage/index/ID/head 和 isError；未知或畸形协议调用保持 JSON-RPC 错误。区分安全的 BUSY、已证明未发布、结果未知及重启基础设施状态，不暴露私有 cause、SQL 或正文文本。 |
| P06 | H/T：覆盖声明长度、分块和多字节三种恰好 1 MiB 的请求，以及明确超限的 POST/DELETE 413；100 条命令在一个 Revision 中成功，101 条被拒绝；独立会话间四个活动调用可执行，第五个明确拒绝；断开连接的工作仍占用槽位；没有静默排队、重试、拆分或强制转换。纯 M1 仍接受 101 条命令。 |
| P07 | H/T：仅绑定回环地址，并要求配置的精确 Host；POST/GET/DELETE 缺失或错误 token/Host 均被禁止；Origin 缺失或精确匹配时允许，任意值、null、未列出值及多余尾缀均禁止。记录并验证操作者配置；调用方提供的 author/client/time/system 字段被拒绝且不发布。 |
| P08 | H/生产命令冒烟：覆盖无效端口、token、author、origin、存储就绪、错误/不支持的格式，以及固定端口冲突可见且不替换端口；会话关闭/DELETE 后独立服务和 Claim 仍存在；DELETE 排空多个请求且不重新开放接纳；优雅停止拒绝新调用、完成已有工作并关闭存储。 |
| P09 | H/T/操作者冒烟/运行器安全证据守卫：畸形协议、UTF-8、JSON、版本、未知工具及敏感存储故障均不暴露 token、私有路径、SQL、裁决、证据正文或 SDK 文案；进程日志使用固定安全文本。服务/存储不可用时明确失败，不切换到另一个权威来源。 |

生产启动/读取路径仍不会执行已撤回的物理、语义或历史审计；测试只枚举夹具中已知的 Revision。打开并比较备份只作为证据，不是 restore/import。受控进程终止/重启证据不能证明硬件或断电故障下的韧性。

## 已安装 Codex 操作与真人门禁

完整运行**已通过**，共执行 **44 次真实原生 MCP 调用**（A 工作流 17 次、独立 B 5 次、恢复后陈旧 A 13 次、服务重启后的 A 9 次）。[已发布调用证据](mcp-sqlite-codex-evidence.json)包含经 schema 验证的原生参数/结果、会话身份、环境/协议及最终客户端观察；仅凭 Agent 最终文字不能作为证明。每次完整读取都会与其精确、持久化的 SQLite 夹具 Revision 独立比较。陈旧请求和重启前后都会比较已知 head、Revision 1–10 的每一项、目录以及不存在的 Revision 11。对已发布产物的附加检查确认：B 的实际参数使用 codex:B，其快照持有该 Claim；陈旧 A 只进行了一次写入；重连后只发起读取。

A 的 thread 为 `01a0b4f1-c05a-7600-8b18-73fa2db7dbca`；B 的独立 thread 为 `01a0b4f2-ff7e-76b2-bb9e-8fd79e29d561`。B 的提示词包含已接受的 M1 命令形状，但不包含 A 的对话或 Map ID。B 从目录中发现 `Acceptance.Codex.Workflow`，读取返回的稳定 ID，在 Revision 9 以 codex:B 领取 Handoff，并在 Revision 10 完成 Settlement。A 在不同 Codex 进程及一次真实服务重启之间延续其原有逻辑会话/Claimant。

| 门禁 | 状态/预期记录证据 |
| --- | --- |
| L01 | **通过。** 已安装 CLI 发现并使用全部四个公开工具，消费经 schema 验证、一次且仅一次的结构化载荷/`content []`，包括紧凑 create、B 的默认紧凑 Settlement，以及显式请求的快照 apply。实际 runtime/SQLite/SDK/检出提交见上；每次观察到的 initialize 均协商为 **2025-06-18**，并使用真实 Streamable HTTP 端点。 |
| L02 | **通过。** Revision 1 create；Revision 2 批量创建 Destination/Ticket/Dependency/Fog/Scope；Revision 3 领取前置项；Revision 4 Completion 返回 `['Handoff','Next']`，直接观察依赖项解锁；Revision 5 领取依赖项，Revision 6 写入 Finding；Revision 7 显式 reopen 两项，返回 `['Handoff','Prep']`；Revision 8 保留 A 新领取的 Prep。较早 Revision 的完整读取保留 Claim/Settlement 及 introducedAtRevision 4/6；当前 reopen 状态不含 Settlement，也没有隐式级联。 |
| L03 | **通过。** 独立 B 首先调用目录，保留/发现同一稳定 ID，并读取观察到的 head 8；随后以不同的 codex:B Claim 在 Revision 9 领取，并在 Revision 10 完成 Completion。快照/紧凑结果均被消费，A 的 Prep Claim 得到保留，没有创建替代 Map，也没有按重名标题进行模糊选择。 |
| L04 | **通过。** 原始 A 刻意以陈旧的 expectedRevision 8 仅写入一次，收到精确的 Conflict/currentRevision 10、失败工具调用状态，且未发布。随后它重读最新 head 及每个已知 Revision，并确认 Revision 11 不存在。真实服务在相同固定端口执行 SIGTERM/停止/重启后，恢复的 A 新 MCP 连接保留精确 head、历史和 Claim，没有过期、接管或额外 Revision；只读重连证明与持久化夹具一致。 |
| L05 | **待定。尚未收到真人现场裁决；规划确认以及通过的自动化/客户端断言均不能替代该裁决。** |

## Standards / Spec 双轴审查与收尾

独立只读审查者以 `1b8d89f277870e24d4b959f1c2cae6c59c218eff` 为固定点检查累计 diff：最初审查 `4833e03`，随后在 `2c9f196` 重新审查修正后的实现。他们检查了源码、断言和文档；没有独立证明命令运行结果，也没有提供 L05。最终发布的现场证据会在请求真人裁决前单独审查。只有全部门禁通过后，才会记录 PR 正常合并、冲突/必需检查、合并后状态以及显式关闭 Issue。CodeRabbit 既不受监控，也不是 Agent 门禁；不会绕过任何仓库必需检查。

### Standards

**通过，0 项发现。** 未发现违反已记录标准的问题，也没有可操作的 Fowler 基线代码异味。变更保留纯领域/公开存储边界以及既有 ESM/Vitest 约定。共享拒绝夹具包含输入和预期公开错误，不复制领域行为。别名测试复用真实内存/SQLite 一致性测试。隔离客户端运行器/观察器不需要臆测式抽象，也不构成委派包装器问题；没有引入源码、公开接口、依赖或权威来源变更。

### Spec

**通过；解决最初 3 项发现后，剩余可操作发现为 0。** 已补充完整的命令/可达最终错误在 SQLite、工具和 HTTP 层的无副作用断言、嵌套数据隔离检查，以及单独的现场前置项 Settlement/依赖项领取流程，并可见解锁后的 Frontier。修正后的现场 head 序列内部一致（A 为 8，B 为 9–10，陈旧值为 8/当前值为 10）。所需客户端启动变更仅影响隔离测试配置。已审查运行器的 L01–L04 随后按上文记录执行通过；L05 仍是真人门禁，单凭审查不能证明 Issue 已完成，也不能授权采纳探索工作。

实现/规划的权威来源仍是 GitHub。未改变探索工作流 skill、既有 rollback/deletion Map、规范项目数据库、永久 MCP 配置、插件、迁移、双写或权威来源切换。已停止并清理的验收夹具不意味着更广泛的 v1 已交付，也不意味着服务持续可用。
