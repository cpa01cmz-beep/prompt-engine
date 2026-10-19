# Prompt Engine & Skills Engine — Product Requirements Document

## 1. Vision
Build a Cloudflare-native, AI-first web application that helps non-developer users create, evaluate, optimize, compare, store, template, and research prompts, and search, research, create, optimize, evaluate, store, and experiment with AI skills. All AI work is automated through OpenAI-compatible model calls, defaulting to an opencode.ai free model.

## 2. Target User
Non-developer users who need a premium, guided, no-code experience for prompt and skill engineering.

## 3. Platform & Constraints
- Cloudflare free tier native (Workers, Static Assets, D1, KV).
- OpenAI-compatible LLM provider, defaulting to opencode.ai free model (`https://opencode.ai/zen/v1`, model `deepseek-v4-flash-free` or another available free model).
- Automated AI pipelines; user should not need to write prompts or code.
- Clean, premium, modern, responsive, accessible UI.

## 4. Functional Requirements

### Prompt Engine
- **Creator:** guided wizard and AI generation from a goal; variables, role, constraints, examples.
- **Evaluator:** automated quality scoring and actionable feedback.
- **Optimizer:** AI rewrite to improve scores; variant generation.
- **Compare:** side-by-side prompt/output/metric comparison.
- **Library:** save, search, filter, version, tag prompts.
- **Template:** reusable templates with variable substitution.
- **Research:** web/AI research on prompt engineering techniques and best practices.

### Skills Engine
- **Search (web):** discover skills from web sources.
- **Research:** research skill domains and patterns.
- **Creator:** create skill definitions with instructions, tools, examples.
- **Optimizer:** improve skill definitions.
- **Evaluator:** score skill quality.
- **Library:** store and manage skills.
- **Lab:** experiment and test skills with AI.

## 5. Non-Functional Requirements
- Performance: fast edge responses; bundle size controlled.
- Accessibility: WCAG 2.2 AA target.
- Security: input validation, safe AI calls, no secret leakage, secure headers.
- Compatibility: modern Chromium, Firefox, Safari/WebKit, mobile viewports.
- Reliability: typed APIs, tests, error handling.

## 6. Architecture (High Level)
- Single Cloudflare Worker serving Vite-built React static assets and Hono API routes.
- D1 (SQLite) for persistent library/template/skill/evaluation data.
- KV for caching and rate limiting.
- Worker proxies OpenAI-compatible AI requests.

## 7. Quality Gates
Build, lint, typecheck, static analysis, unit, integration, e2e, security, accessibility, performance, compatibility.

## 8. Risks & Assumptions
- Cloudflare free-tier limits (D1 rows, Worker CPU, KV reads).
- AI provider availability and rate limits.
- Web search scraping may be restricted; use safe search endpoints or AI research fallback.
- Default free model availability may change; configurable.
