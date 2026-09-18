# Wayfinder Map Service

Wayfinder Map Service is a client-neutral decision-map system for ChatGPT, Codex, and other MCP-capable agents.

It combines two explicit workflows:

- `@grilling` explores the current decision frontier in rounds.
- `@wayfinder` manages long-running work as a persistent map of destinations, decisions, tickets, dependencies, evidence, and revisions.

The remote service owns canonical state. Clients interact through a small MCP interface, while a web renderer and optional MCP Apps UI present the same map visually.

## Current status

M1 Map core implementation is in progress. The accepted handoff is [docs/spec/m1.md](docs/spec/m1.md); the wider v1 product contract is [docs/spec/v1.md](docs/spec/v1.md).

Track implementation in [GitHub Issues](https://github.com/kun-g/wayfinder_map_service/issues) and the private [M1 project board](https://github.com/users/kun-g/projects/5). Active rollback/deletion planning uses [GitHub planning Maps](docs/planning/README.md). Completed M1 planning decisions and prototype captures are preserved in [the planning archive](docs/archive/m1-planning/README.md).

## Project documents

- [Domain language](CONTEXT.md)
- [v1 executable specification](docs/spec/v1.md)
- [Accepted M1 implementation specification](docs/spec/m1.md)
- [Active planning Maps](docs/planning/README.md)
- [M1 planning archive](docs/archive/m1-planning/README.md)
- [ADR 0001: remote map as authoritative state](docs/adr/0001-remote-map-is-authoritative.md)
- [ADR 0002: MCP tools are the primary interface](docs/adr/0002-mcp-tools-are-the-primary-interface.md)
- [Agent workflow and project-local skills](AGENTS.md)
- [Matt Pocock skill provenance](docs/agents/skills-provenance.md)

## Provenance

The interaction methods originate from Matt Pocock's MIT-licensed [`mattpocock/skills`](https://github.com/mattpocock/skills). This project preserves upstream provenance while maintaining a product-specific adaptation for convergence, persistence, portability, and recovery.
