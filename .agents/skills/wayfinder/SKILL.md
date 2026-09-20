---
name: wayfinder
description: "Plan work that spans more than one agent session as a shared Wayfinder Map, then resolve one Decision Ticket at a time."
---

Use Wayfinder when an effort needs persistent exploration state across sessions. It is a planning method by default: arrive at a clear route to the Destination rather than implementing that route unless the Map explicitly includes execution.

## Authority

For a connected Wayfinder MCP service, its initialization instructions and four Map tool descriptions are the complete operational contract. Follow them directly. Do not require a repository file, copied prompt or installed Skill for correctness, and do not maintain a second Map body in conversation, files or GitHub.

GitHub Issues coordinate implementation; they are not product Map state. Existing project-specific trackers may remain on their documented authority until migrated.

## Method

### Chart

Use grilling and domain modeling to make the Destination observable, identify the currently precise Questions and Dependencies, and separate remaining Fog from Scope Exclusions. If the route is already clear and fits one session, explain that a Map is unnecessary. Otherwise create and publish the Map by following the server-supplied workflow.

### Advance

Resume the authoritative Map, choose one eligible Decision Ticket, and reserve it before work. Use the method appropriate to its type:

- research produces a sourced Finding;
- prototype and grilling preserve the live human verdict gate;
- task records a Completion only after the prerequisite work is done.

Advance at most one Decision Ticket per logical session except independently delegated research. Record compact Evidence, References and Provenance, then follow the server-supplied workflow to commit the typed Settlement and any newly precise route changes atomically.

Refer to Maps and Decision Tickets by human-readable title in conversation and retain their stable IDs for tool calls.
