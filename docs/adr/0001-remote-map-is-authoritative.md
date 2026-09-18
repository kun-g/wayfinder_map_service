---
status: accepted
---

# The remote map is authoritative

Wayfinder state lives in a remote Map Service rather than ChatGPT Project files, local skill directories, or conversation history. A remote authority gives every MCP-capable client the same current revision, while local conversations and exported files remain projections or recovery material.

## Considered options

- ChatGPT Project files provide useful shared context but do not provide a documented in-place write and versioning contract.
- Local Markdown works for one coding environment but cannot provide a uniform cross-device or cross-product state owner.
- A remote map makes authentication, revision conflicts, sharing, rendering, export, and deletion consistent for every client.

## Consequences

The product requires an always-on HTTPS service and a deliberate outage path. Clients must treat cached or conversational state as stale until reconciled with the service.
