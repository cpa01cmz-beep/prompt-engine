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

## Chronological Log (continued)
- Backend security hardening commit `ea1a7e3`: closed SSRF/secret-exfiltration path in AI settings; error reflection fixed; zod validation.
- Frontend settings modal commit pending: user can switch provider/model presets; secrets remain env-only.
- Default AI model updated to available free model `deepseek-v4.1-flash-free`.
- E2E tests: 102/102 passed across Chromium, Firefox, WebKit.
- Quality evidence recorded under `docs/evidence/`.
- Residual dev-only audit warnings: none (npm audit --omit=dev and full audit both 0 vulnerabilities).

- Discovered 104 specialized agents under `.opencode/agents/`.
- Full inventory recorded in `docs/agent-inventory.md`.
- Future tasks should be assigned to best-suited specialized agents instead of generic `general` where possible.
