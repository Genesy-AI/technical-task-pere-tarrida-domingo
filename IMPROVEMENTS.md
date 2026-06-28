**Security**
- Set up CORS (Access-Control-Allow-Origin: *) currently everybody can has access
- Zero authentication on any endpoint (all routes public) we need to add JWT authentication
- No rate limiting (bulk import, SSE stream are high-value DoS targets)
- frontend/src/utils/axios.ts — VITE_API_URL not validated as HTTP(S) URL
- frontend/src/components/LeadsList.tsx — lead.message rendered without XSS escaping

**Performance**
- backend/src/index.ts:202-208 N+1: loads ALL leads into memory for dedup check
- backend/src/handlers/verifyEmails.ts:36 / enrichPhoneNumber.ts:45 — unbounded concurrency wf needs to be parallel (10K leads = 10K
simultaneous workflows)
- No pagination on GET /leads — returns full table
- frontend/src/components/LeadsList.tsx:103-109 — Intl.DateTimeFormat created per row per render should be passed from the backend
- frontend/src/components/CsvImportModal.tsx — CSV parsed on main thread (blocks UI for large files)

**UX/UI**
- Bulk delete fires with no confirmation dialog (one click = data loss)
- Emoji-only status indicators (❓✅❌) — inaccessible, no text fallback add alt to be sure that something is being displayed
- No retry button on error state — user must reload
- No copy-to-clipboard for phone/email fields

**Error Handling**
- All catch blocks: res.status(500) with no logging of actual error
- No structured logging (zero winston/pino/bunyan)
- Frontend mutations show generic toast, not field-specific backend errors

**Validation**
- backend/src/index.ts — Number(id) not NaN-checked before Prisma call
- No email format validation on backend
- No array size limit on leadIds (could send millions)
- prisma/schema.prisma — no field length constraints (@db.VarChar)
- Frontend email regex (csvParser.ts:19) accepts invalid patterns (a@b.c, double dots)

**API Design**
- Inconsistent HTTP status codes (no 201, 204, 409)
- PATCH only updates firstName/email — other fields not patchable
- No correlation/request IDs for log tracing
- No OpenAPI/Swagger spec

**Architecture**
- backend/src/index.ts is one massive file (routes + worker startup)
- Frontend: LeadsList.tsx (408 lines), CsvImportModal.tsx (351 lines) — monolithic
- No custom hooks (useLeads(), useModalBackdrop())
- Temporal address/task queue hardcoded (localhost:7233, myQueue)
- No container config (Dockerfile, docker-compose)
- No CI/CD pipeline
- SQLite not production-suitable
- No /health endpoint
- No reusable components

**Testing**
- 0% HTTP route coverage on backend
- No integration tests
- No E2E tests
- No negative/security input tests
- No Temporal-specific timeout/retry tests
- Frontend missing: CSV edge cases, encoding, quote escaping

