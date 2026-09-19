# New exploration Maps through Wayfinder MCP

After the accepted local MCP/SQLite workflow adoption, every **new exploration Map** uses the product MCP service as its sole state authority. This applies to Wayfinder planning started after adoption. GitHub remains authoritative for implementation Issues and PRs. The existing Revision rollback and Ticket/Map deletion planning Maps remain on GitHub until a separately accepted migration; never copy or dual-write them.

Use exactly `map_create`, `map_list`, `map_read`, and `map_apply`. The service owns authorship and time. Conversation text, local notes, GitHub comments, research files and prototypes may supply evidence or process context, but none is a second current-state store.

## Create a new exploration Map

1. Finish the Wayfinder destination/frontier discussion before writing. Choose a stable, valid `mapId` and a distinct logical `claimantId` for the work session. Retain both in the session context.
2. Call `map_list` through every required page before creation. A matching title is a discovery hint, never an authoritative handle. If the intended Map already exists, retain its returned `mapId` and resume it. If several titles match and the stable ID is unknown, ask the human which Map they mean.
3. Call `map_create` once. A duplicate or an uncertain result triggers discovery and reread, never creation of a replacement Map.
4. Use the returned Revision as `expectedRevision` for one ordered `map_apply` batch that creates the currently specified Tickets, then adds their Dependencies and the current Fog/Scope Exclusions. Keep later fog out of the batch until it becomes a precise Question.

The stored Map fields carry the Wayfinder model:

| Wayfinder concept | Product state |
| --- | --- |
| Destination | Map `destination` |
| Standing workflow context | Map `notes` |
| Question | Ticket `question` and type |
| Blocking | Ticket Dependencies |
| Frontier | `frontier` returned with the selected Revision |
| Work-session reservation | logical Claim |
| Answer | typed Settlement |
| Decisions so far | settled Tickets, derived on read |
| Not yet specified | Fog content |
| Out of scope | Scope Exclusion content |

## Resume and advance

1. With a retained `mapId`, call `map_read` without a Revision to observe the authoritative current state. Without it, page through `map_list`, retain the selected stable ID, then default-read it. Never create from title ambiguity.
2. Select only a Ticket returned in the current Frontier. Before doing its work, acquire its Claim with the session's `claimantId` and the just-observed Revision. Continue only after the committed result succeeds; retain the new Revision.
3. Resolve at most one Ticket per logical session, except independently delegated research Tickets. Read any prerequisite history or linked artifact needed for the work without treating those copies as current Map state.
4. Advance with `map_apply` against the latest retained Revision. Settle the claimed Ticket with the matching Claimant and Ticket type. Put newly precise Tickets, Dependencies, Fog changes and Scope Exclusions in the same ordered atomic batch when they are part of that resolution. Retain the committed Revision returned by the service.

Settlement preserves the method's decision boundary:

- `grilling` and `prototype` use a Decision only after the human gives the live verdict; the agent never supplies the human side.
- `research` uses a Finding supported by its primary-source artifact and References/Evidence.
- `task` uses a Completion only after the work is actually complete.
- Every Settlement records meaningful Provenance. Unfinished work remains open and claimed or is explicitly released; it is not represented as a successful Settlement.

## Conflicts, uncertainty and outages

- On Conflict, reread current state and the relevant history. Decide whether the original intention is already satisfied or still valid against the new Frontier. Any later write is a new deliberate request using the reread Revision; never replay, merge or take over automatically.
- On an infrastructure result with unknown outcome, reread before deciding. If the service cannot be reached, stop authoritative advancement until it returns. Local memory, files and GitHub are not fallbacks.
- A proven non-publication still requires a deliberate later request; it does not authorize an automatic retry.
- Claims do not expire with a client connection. A different session uses a distinct Claimant and cannot take over. Release or clear requires the explicit M1 command and reason.

The implementation tracker and product Map serve different purposes. Record code changes, reviews and delivery evidence on GitHub; record exploration Destination, Questions, Claims, Settlements, Fog and Scope only in the MCP Map.
