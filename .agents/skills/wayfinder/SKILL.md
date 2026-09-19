---
name: wayfinder
description: "Plan work that spans more than one agent session as a shared Wayfinder Map, then resolve one decision Ticket at a time. New exploration Maps in this repository use the product MCP workflow."
---

A loose idea has arrived, too large for one agent session and wrapped in fog. Wayfinding finds the route to a named **Destination** by charting Questions as Tickets, then resolving them one at a time until the route is clear.

## Authority

For this repository, every new exploration Map uses Wayfinder MCP as its sole state authority. Before creating, discovering, resuming or advancing one, read the [new exploration MCP workflow](../../../docs/agents/exploration-mcp.md). It defines the exact tool sequence, stable handles, Claim rule, typed Settlement rule, conflict/uncertainty handling and outage boundary.

GitHub remains the implementation Issue/PR tracker. The existing Revision rollback and Ticket/Map deletion planning Maps remain on GitHub until separately migrated; follow [the GitHub tracker workflow](../../../docs/agents/issue-tracker.md) only for those inherited Maps or implementation work.

## Plan, don't do

Wayfinder is planning by default. Each Ticket resolves a decision; the Map is done when the way to the Destination is clear and nothing remains to decide before implementation. An effort may say in its Notes that execution belongs inside the Map, but absent that instruction, produce decisions rather than deliverables.

## Refer by name

Every Map and Ticket has a human-readable title plus a stable ID. In user-facing narration refer to the title, using the stable ID only to disambiguate and operate the MCP tools. Titles may repeat and never select a Map or Ticket by themselves.

## The Map

The Map is the canonical index for one planning effort:

- **destination** says what reaching the end looks like.
- **notes** carry standing workflow context, including skills each session should consult.
- Open Tickets hold bounded Questions.
- Dependencies determine which Tickets are eligible.
- The returned Frontier is the open, dependency-ready set.
- Claims reserve eligible Tickets for logical work sessions.
- Typed Settlements hold accepted Answers and Provenance.
- Settled Tickets form the derived Decisions-so-far view.
- Fog holds in-scope questions that cannot yet be stated precisely.
- Scope Exclusions hold work consciously ruled beyond the Destination.

Do not maintain a second Map body or Decisions list in files, GitHub or conversation. Files and links may be evidence referenced by a Settlement.

## Ticket types

Every Ticket is either HITL, where the human speaks for themselves, or AFK, where the agent can complete the method:

- **Research** (AFK): investigate a precise question against primary sources, produce a cited artifact, and settle with a Finding.
- **Prototype** (HITL): build a disposable artifact that makes a design question concrete. Settle with a Decision only after the human gives the verdict.
- **Grilling** (HITL): interview the human until the relevant decision tree is settled. Settle with their Decision and rationale.
- **Task** (AFK or HITL): complete concrete prerequisite work. Settle with a Completion only after the work is done.

A HITL Ticket remains open until the live verdict. The agent never supplies the human side. Unfinished work is not a successful Settlement.

## Fog of war

Fog is the dim view of in-scope decisions that cannot yet be phrased as precise Questions. Create a Ticket when the Question is sharp, even if blocked. Keep it in Fog when it is not.

Fog excludes settled decisions, live Tickets and work outside the Destination. Resolving a Ticket may make part of the Fog precise; graduate that part into new Tickets and remove the corresponding Fog content in the same atomic advance.

## Out of scope

Scope Exclusions are work consciously ruled beyond the Destination. They do not graduate. If a live Ticket proves to be outside the Destination, record the disposition deliberately rather than settling it as a decision on the route.

## Invocation

There are two modes. Resolve no more than one Ticket per logical session, except independently delegated research Tickets.

### Chart a new Map

1. **Name the Destination.** Use **grilling** and **domain-modeling** to define what this effort must make clear.
2. **Map the Frontier.** Grill breadth-first to surface the Questions that are precise now, their Dependencies and the remaining Fog. If the route is already fully clear and fits one session, explain that a Map is unnecessary and ask how the user wants to proceed.
3. **Create once.** Follow the MCP workflow's catalog check, stable Map ID selection and **map_create** rule. Retain the returned ID and Revision.
4. **Publish the first frontier atomically.** In one ordered **map_apply**, create specified Tickets before their Dependencies, then write current Fog and Scope Exclusions.
5. **Start eligible research.** Claim each independently delegated research Ticket before dispatch. Each researcher settles only its own Ticket with cited Finding evidence.
6. Stop after charting; do not hand-resolve a non-research Ticket in the same session.

### Work through a Map

1. **Resume authoritatively.** Use the retained stable Map ID, or discover it through the catalog as the MCP workflow specifies. Default-read the current Revision and Frontier.
2. **Choose one Ticket.** Use the user's named Ticket when supplied; otherwise choose the first suitable Frontier Ticket. Acquire its Claim with this logical session's distinct Claimant before doing work.
3. **Resolve it.** Read only the history and referenced artifacts needed. Invoke the Ticket-type skill and preserve human decision gates.
4. **Advance atomically.** Settle the claimed Ticket with the matching type, Claimant, Evidence and Provenance. Include any newly precise Tickets, Dependencies, Fog changes and Scope Exclusions in the same ordered request when they arise from the resolution.
5. **Retain the committed Revision.** Treat it as known context for the current session. On a later session, conflict, uncertain write or connection loss, reread before deciding.

The user may run eligible Tickets in parallel. Expect other sessions to advance the same Map, use distinct Claimants and follow the conflict rules instead of taking over or replaying writes.
