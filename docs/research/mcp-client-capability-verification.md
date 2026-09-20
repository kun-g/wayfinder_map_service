# MCP client capability verification: ChatGPT and Codex

Date checked: 2026-09-19
Question: What do ChatGPT and Codex actually discover, surface, or use from MCP initialization `instructions`, tool descriptions, Resources, and Prompts, and what compatibility limits matter for a self-contained Wayfinder MCP server?

## Finding

For the compatibility target in this repository, the only workflow-bearing surfaces that current official OpenAI documentation explicitly says both ChatGPT and Codex use are initialization `instructions` and tool metadata. Tool discovery and invocation are also the only behavior that is documented and already exercised end to end in this repository. Generic MCP Resources and Prompts are protocol-standard features, but the MCP specification deliberately leaves their presentation and use to the host, and current OpenAI product documentation does not promise that either product will automatically list, read, select, or inject them at runtime. They therefore cannot be correctness dependencies for the shared ChatGPT/Codex workflow without separate product-specific acceptance evidence.[1][2][3][4][5][6]

The defensible minimum is:

1. Put the cross-tool safety workflow in initialization `instructions`, with the essential rule set complete in the first 512 characters because OpenAI explicitly recommends that bound for Codex and for plugin MCP servers.[5][6]
2. Keep each operation's local selection and safety rules in the tool name, description, schema, and annotations. OpenAI says the model uses those fields to decide whether and how to call a tool.[6][7]
3. Treat a workflow Resource and an MCP Prompt as optional affordances until each target client has a repeatable acceptance test showing how a user or model discovers and uses it. The protocol itself does not make Resources automatic or Prompts model-controlled.[2][3]

## Verified behavior by surface

| MCP surface | Protocol semantics | Codex evidence | ChatGPT evidence | Compatibility conclusion |
| --- | --- | --- | --- | --- |
| Initialize `instructions` | The server may return `instructions` in its initialize result. The field is independent of the optional `tools`, `resources`, and `prompts` server capabilities.[1] | OpenAI explicitly says Codex reads the field and uses it as server-wide guidance alongside the tools. It recommends cross-tool workflows, constraints, and rate limits here, and says to keep the first 512 characters self-contained.[5] | OpenAI's plugin server guide explicitly says ChatGPT and Codex use server instructions alongside tool metadata, again recommending that the most important content be in the first 512 characters.[6] | This is the strongest shared server-native place for mandatory cross-tool workflow rules. The documentation establishes model use, but does not document a user-facing UI that displays the instructions verbatim. |
| Tool descriptions and schemas | Tools are model-controlled. Clients discover them with `tools/list`; each tool includes a human-readable description and input schema.[4] | Codex documents MCP servers as giving it third-party tools and context. This repository's installed-client acceptance directly observed Codex CLI 0.153.0 discover and call all four Wayfinder tools; the negotiated protocol was `2025-06-18`.[5][11][12] | In developer mode, ChatGPT asks the developer to review the tools and metadata discovered from the server. OpenAI's test procedure explicitly covers names, descriptions, schemas, and annotations, and requires refresh/retest after they change. OpenAI also says the model uses this metadata to decide whether and how to call a tool.[6][7] | This is the strongest shared, exercised operation-specific surface. Descriptions should remain locally sufficient even when server instructions are truncated, a product path handles them differently, or the model attends to them imperfectly. |
| Generic Resources | Resources are application-driven. A host may provide a picker, search, heuristic inclusion, or model selection, but the protocol mandates none of those UI/selection patterns.[2] | Current Codex MCP documentation's supported-feature list names transports and server instructions, but does not state a runtime contract for `resources/list` or `resources/read`.[5] | OpenAI says an MCP server *can expose* Resources, but its documented ChatGPT runtime path concentrates on tools. It separately documents UI resources and static skill-resource import, neither of which establishes automatic use of an arbitrary workflow Resource.[6][7][8] | A `wayfinder://workflow/exploration` Resource is standards-compliant and potentially useful, but it is not a portable enforcement mechanism. A tool can return an embedded Resource or resource link, but protocol support still does not require a host to turn a catalog Resource into standing model guidance.[2][4] |
| MCP Prompts | Prompts are user-controlled and intended for explicit selection, often through UI commands. The protocol leaves their UI exposure entirely to implementations.[3] | Current Codex MCP documentation does not document `prompts/list`, `prompts/get`, a prompt picker, or slash-command mapping for configured MCP servers.[5] | OpenAI says an MCP server can expose Prompts, but the current plugin build/test documentation does not specify that ChatGPT exposes MCP Prompts, how a user selects one, or whether one is automatically used.[7][8] | An MCP Prompt may be offered as an enhancement, but must not carry rules required for safe Map mutation. It also cannot replace server instructions because its protocol interaction model is opt-in by design.[3] |

## Important limits and distinctions

### “Supported by MCP” is not “automatically used by a client”

The 2025-11-25 MCP specification defines separate server capabilities for Prompts, Resources, and Tools. Capability negotiation only establishes which protocol operations are available. It does not require a host to expose a Resource picker, inject a Resource, show a Prompt command, or have a model invoke a Prompt. Resources are explicitly application-driven, Prompts user-controlled, and Tools model-controlled.[1][2][3][4]

Initialization `instructions` are different: they are part of the initialize result rather than a separately listed catalog. OpenAI provides a direct product contract that Codex and ChatGPT use them alongside tool metadata.[1][5][6]

### ChatGPT “connector,” developer-mode MCP connection, and plugin are not interchangeable guarantees

Current OpenAI documentation describes ChatGPT web as using remote MCP-backed tools supplied by plugins, while MCP servers configured on a Codex host apply to the ChatGPT desktop app, Codex CLI, and IDE extension. The Codex documentation warns that hosted plugin tools can have different capabilities.[5] Therefore a successful Codex-host test does not establish identical ChatGPT web behavior, and a ChatGPT plugin test does not establish generic behavior for every “connector” or workspace policy. Developer mode availability itself can depend on account and workspace policy.[8]

The repository should name the exact tested surface in acceptance evidence: for example, “ChatGPT web developer-mode plugin connection” versus “ChatGPT desktop using Codex-host MCP configuration.”

### Protocol versions must be negotiated, not assumed

MCP initialization requires the client and server to negotiate a mutually supported protocol version and disconnect if the client's chosen server response is unsupported.[1] This repository's SDK client tests negotiated `2025-11-25`, while the real installed Codex CLI 0.153.0 acceptance run negotiated `2025-06-18` against the same service.[11][12] A self-contained workflow must therefore avoid depending on a feature merely because it appears in the latest protocol revision; the target client's negotiated version and product behavior must be observed.

### Rich workflow packaging has a separate OpenAI path

OpenAI documents a bounded, static subset of the draft SEP-2640 Skills extension for plugin submission. A server advertises skills, and ChatGPT's **Scan Tools** imports a static snapshot by calling `skills/list`, `skills/get`, and `resources/read`. OpenAI expressly says this extension is not yet part of the stable MCP specification.[6] This can eliminate repository-relative links in a packaged ChatGPT skill, but it is a distribution-time import path, not evidence that arbitrary generic Resources or MCP Prompts become runtime standing instructions. It also requires version refresh/republication discipline rather than giving live single-source semantics.[6][8]

## Wayfinder-specific observation

The service currently declares only the `tools` capability and supplies no initialization `instructions`.[9] Its four descriptions are concise and useful locally, but they do not encode the full exploration workflow: for example, `map_create` does not require a complete paginated catalog check; `map_list` does not say that every page must be read before creation; and the Claim/Settlement rules span multiple tools.[10] The behavior observed in the user's earlier ChatGPT exchange came from a copied Skill that linked to a repository-relative document, not from the MCP server. That observation is consistent with the current server shape, but it is conversation evidence rather than a general ChatGPT product contract.

This means the proposed initialization instructions would close a real server-side context gap. A generic Resource or Prompt alone would not close it across both target clients based on currently documented behavior.

## Unknowns requiring explicit acceptance tests

Official sources reviewed on 2026-09-19 do **not** establish the following:

- whether ChatGPT web or ChatGPT desktop issues `resources/list` for an ordinary non-UI, non-skill MCP Resource;
- whether either ChatGPT surface presents ordinary MCP Prompts to the user or calls `prompts/list`/`prompts/get`;
- whether Codex CLI, IDE, or desktop exposes generic MCP Resources or Prompts through UI or model context;
- how much initialization `instructions` content beyond the first 512 characters is consistently available to each model turn;
- whether product-side caching delays changed initialization instructions (ChatGPT documents an explicit metadata refresh flow for tool metadata, but not an instructions-specific refresh guarantee).[5][8]

Those are unknown/undocumented behaviors, not verified non-support. If Resources or Prompts are implemented, acceptance should capture wire traffic plus user-visible/model-visible behavior on the exact named ChatGPT and Codex surfaces.

## Sources

1. Model Context Protocol, “Lifecycle,” protocol version 2025-11-25: initialize result, capability negotiation, and version negotiation. <https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle>
2. Model Context Protocol, “Resources,” protocol version 2025-11-25: application-driven interaction model and `resources/list`/`resources/read`. <https://modelcontextprotocol.io/specification/2025-11-25/server/resources>
3. Model Context Protocol, “Prompts,” protocol version 2025-11-25: user-controlled interaction model and `prompts/list`/`prompts/get`. <https://modelcontextprotocol.io/specification/2025-11-25/server/prompts>
4. Model Context Protocol, “Tools,” protocol version 2025-11-25: model-controlled interaction model, tool discovery, descriptions, resource links, and embedded resources. <https://modelcontextprotocol.io/specification/2025-11-25/server/tools>
5. OpenAI, “Model Context Protocol – Codex”: supported surfaces, hosted-plugin caveat, server instructions, 512-character guidance, and configuration. <https://developers.openai.com/codex/mcp>
6. OpenAI, “Build an MCP server”: ChatGPT/Codex server-instruction behavior, tool-metadata behavior, and the bounded draft Skills extension. <https://developers.openai.com/plugins/build/mcp-server>
7. OpenAI, “MCP server”: server feature overview and documented tool discovery/model-selection flow. <https://developers.openai.com/plugins/concepts/mcp-server>
8. OpenAI, “Connect and test your plugin”: ChatGPT developer-mode discovery, evaluation, refresh, workspace-policy limit, and Scan/packaging workflow. <https://developers.openai.com/plugins/deploy/connect-chatgpt>
9. Wayfinder implementation, `createMapMcpServer`: current advertised capability and absence of server instructions. [`src/mcp-tools.ts`](../../src/mcp-tools.ts)
10. Wayfinder implementation, current tool definitions and descriptions. [`src/mcp-schemas.ts`](../../src/mcp-schemas.ts)
11. Wayfinder direct installed-Codex acceptance report: client version, negotiated protocol, and L01 discovery/call result. [`docs/implementation/mcp-sqlite-acceptance.md`](../implementation/mcp-sqlite-acceptance.md)
12. Wayfinder machine-readable installed-Codex acceptance evidence. [`docs/implementation/mcp-sqlite-codex-evidence.json`](../implementation/mcp-sqlite-codex-evidence.json)
