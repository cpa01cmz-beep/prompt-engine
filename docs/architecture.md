# Architecture

## Overview
Prompt Engine + Skills Engine is a Cloudflare-native web application. A single Cloudflare Worker serves the Vite-built React static assets and Hono API routes. Data persists in D1 (SQLite). KV provides caching and rate limiting. AI requests are proxied through the Worker to an OpenAI-compatible provider (default opencode.ai free model).

## Platform
- Cloudflare Workers + Static Assets
- D1 (SQLite) for persistent library/template/skill/evaluation data
- KV for caching and rate limiting
- Worker proxies OpenAI-compatible AI requests

## API
- Framework: Hono
- Routes under `/api/*`: health, prompts, templates, skills, evaluations, settings, ai
- JSON request/response, typed via shared types

## Frontend
- React + Vite + TypeScript + Tailwind CSS
- Premium responsive design, WCAG 2.2 AA target
- Client built to `dist/client`, served by Worker static assets

## D1 Schema
Tables: prompts, templates, skills, evaluations, settings (see migrations/0001_init.sql).

## AI Provider Integration Pattern
- OpenAI-compatible chat completions endpoint
- Config from env: OPENAI_BASE_URL (default https://opencode.ai/zen/v1), OPENAI_MODEL (default deepseek-v4-flash-free), OPENAI_API_KEY optional
- Worker-side calls only; no secrets in client

## Folder Structure
- `src/client` - React frontend
- `src/worker` - Cloudflare Worker + Hono API
- `src/shared` - shared TypeScript types
- `migrations` - D1 migrations
- `tests` - unit/integration/e2e
- `docs` - documentation and evidence
- AGENTS.md in every folder
