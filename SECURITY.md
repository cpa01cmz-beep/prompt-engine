# Security Policy

## Supported versions

This is a fast-moving private project; only the latest `main` is supported.

## Reporting a vulnerability

Use GitHub's **private vulnerability reporting** on this repository (Security tab &nbsp;→&nbsp; Report a vulnerability). Do **not** open a public issue.

Please include: affected endpoint or file, reproduction, and impact assessment.

## Areas worth extra scrutiny

- **Upstream AI provider traffic** (`src/worker/services`) — provider API keys are stored in settings storage and must never be logged or surfaced in responses. Client-visible upstream failures must use the generic body from `src/worker/lib/outboundError.ts`.
- **Settings API** (`src/worker/routes`) — key allowlist and provider origin restrictions are deliberate; don't loosen them.
- **Rate limiting** — designed fail-closed; see `tests/unit/rateLimit.test.ts`.

## Secrets

- Never commit `.env` (gitignored; `.env.example` is the documented shape).
- Runtime secrets belong in Worker secrets/config, not in code.
