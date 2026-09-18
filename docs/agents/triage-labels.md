# Triage labels

GitHub implementation issues and retained local planning tickets use the same canonical triage vocabulary. GitHub uses a label with the canonical role's exact name; local planning uses the `Triage:` value below. All five canonical labels are provisioned in the GitHub repository.

| Canonical role | Local `Triage:` value | Meaning |
|---|---|---|
| needs-triage | needs-triage | Awaiting assessment |
| needs-info | needs-info | Missing information |
| ready-for-agent | ready-for-agent | Specified and agent-ready |
| ready-for-human | ready-for-human | Requires human execution |
| wontfix | wontfix | Deliberately declined |

GitHub uses `bug` or `enhancement` labels independently of open/closed state and native blocking edges. Local planning uses `Category: bug` or `Category: enhancement` independently from execution `Status`. Each triaged ticket has one category and one triage role.

Tickets produced from an approved specification are already specified: apply `ready-for-agent` directly, without an additional triage interview. A blocker still prevents starting work even with that label.
