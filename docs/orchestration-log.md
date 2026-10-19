# Orchestration Log
## Available Agents
- `explore`: fast codebase exploration, file/pattern search, questions.
- `general`: general-purpose implementation, research, multi-step tasks.
- Agency subagents: 104 curated agents installed under `.opencode/agents/` (from msitarzewski/agency-agents), including engineering, testing, security, design, product, research, and agents-orchestrator. Invoke via `@agent-name`.
## Assignment Rationale
- Research/planning/documentation/coordination: orchestrator.
- Implementation, scaffolding, tests, repository administration: `general`.
- Codebase exploration and evidence collection support: `explore`.
- Specialized domain work: agency subagents (e.g. `@frontend-developer`, `@code-reviewer`, `@accessibility-auditor`).
## Chronological Log
- Initial repository inspected: empty except README.md.
- PRD, task breakdown, review plan, orchestration log created.
- Agency agents installed from GitHub into `.opencode/agents/`.
- Next: delegate architecture and scaffold.

## Agent Inventory Update
- Discovered 104 specialized agents under `.opencode/agents/`.
- Full inventory recorded in `docs/agent-inventory.md`.
- Future tasks should be assigned to best-suited specialized agents instead of generic `general` where possible.
