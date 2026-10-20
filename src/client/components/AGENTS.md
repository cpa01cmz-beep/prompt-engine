# AGENTS.md — src/client/components

## Scope
Shared UI primitives and shell components for the `modules/` features:
- `ui.tsx` — the design-system single source: Card, Button, Alert, Input, Textarea, Field, Spinner, Loading, Skeleton, SkeletonText, ResultPanel, Chip, Stat, EmptyState, ErrorText, SuccessText.
- `Login.tsx` — auth gate (`onLogin(user)` callback).
- `SettingsModal.tsx` — settings incl. AI provider override.

## Rules
- Reuse `ui.tsx` primitives before creating new markup; add new primitives here, not inside modules.
- Keep components stateless w.r.t. auth — tokens come from `../lib/auth`, data from `../lib/api`.
