# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TinyEnginy** — a leads management app. Monorepo with `backend/` (Express + Prisma + Temporal) and `frontend/` (React + Vite + TanStack Query). No root-level scripts; all commands run from within each directory.

## Commands

### Backend (`cd backend`)

```bash
pnpm run dev          # Start Express API + embedded Temporal worker (port 4000)
pnpm migrate:dev      # Apply Prisma migrations to dev.db
pnpm gen:prisma       # Regenerate Prisma client after schema changes
pnpm test             # Run vitest
pnpm test:watch       # Run vitest in watch mode
pnpm build            # Compile TypeScript to dist/
```

Temporal server must run separately:
```bash
temporal server start-dev   # Starts on localhost:7233
```

### Frontend (`cd frontend`)

```bash
pnpm run dev          # Start Vite dev server (port 5173)
pnpm lint             # ESLint (max-warnings 0)
pnpm test             # Run vitest
pnpm build            # Type-check + Vite build
```

## Architecture

### Backend

Single entry point `src/index.ts` — mounts all Express routes AND starts the Temporal worker in the same process via `runTemporalWorker()`.

**Database:** Prisma with SQLite (`prisma/dev.db`). Schema at `prisma/schema.prisma`. The `lead` model is the only entity.

**Temporal setup:**
- Worker registered to task queue `myQueue`
- Workflows: `src/workflows/workflows.ts` (exports `verifyEmailWorkflow`)
- Activities: `src/workflows/activities/utils.ts` (exports functions used by workflows)
- `src/workflows/index.ts` re-exports from `workflows.ts` — Temporal worker uses this as `workflowsPath`
- Worker timeout for `verifyEmail` activity is `1 second` (intentionally tight — relevant for the email verification bug)

**Message template system:** `src/utils/messageGenerator.ts` — replaces `{fieldName}` placeholders. Throws on unknown or missing fields. Available fields mirror the `Lead` interface in that file.

### Frontend

**API layer** (`src/api/`):
- `utils.ts` exports `endpoint()` — a typed factory that wraps axios calls. Accepts a method + static path or dynamic path builder `(input) => string`.
- `modules/leads.ts` composes all lead endpoints using `endpoint()`.
- `api/index.ts` exports the unified `api` object used throughout the app.
- Types per endpoint live in `api/types/leads/<operation>.ts`.

**State management:** TanStack Query for server state. `useApiMutation` in `api/mutations/` wraps mutations.

**CSV import:** Parsed entirely in the frontend (`src/utils/csvParser.ts` using PapaParse), then POSTed as JSON to `POST /leads/bulk`. The parser normalizes headers by lowercasing and stripping non-alpha chars (e.g., `countryCode`, `country_code`, `COUNTRYCODE` all map to `countryCode`).

**Components:** `LeadsList.tsx` is the main view. `CsvImportModal.tsx` handles file upload + preview. `MessageTemplateModal.tsx` handles message generation with `{fieldName}` templates.

## Key Data Flow

1. CSV upload → `parseCsv()` in frontend → `POST /leads/bulk` → backend validates + deduplicates + inserts via Prisma
2. Email verification → `POST /leads/verify-emails` → backend starts `verifyEmailWorkflow` via Temporal client → worker executes `verifyEmail` activity → result stored in `lead.emailVerified`
3. Message generation → `POST /leads/generate-messages` → `generateMessageFromTemplate()` called per lead

## Known Bugs (Task Context)

- **CSV country codes:** garbled characters on import (encoding/parsing issue in csvParser or CSV files)
- **Email verification hangs:** `jane.smith` emails hit a 20-second `setTimeout` in the activity, but the activity timeout is `1 second` — workflow times out without surfacing a clear error to the frontend
