# RFP Management System - Session Context

## Project Overview
AI-Powered RFP (Request for Proposal) Management System with a React frontend and Node.js/Express backend using PostgreSQL (Sequelize ORM).

## Tech Stack
- **Frontend:** React 18, React Router, Axios
- **Backend:** Node.js, Express, Sequelize (PostgreSQL)
- **AI:** OpenAI API
- **Other:** Multer (file uploads), pdf-parse, nodemailer/imap (email), Helmet, CORS, rate limiting

## Project Structure
```
├── backend/
│   └── src/
│       ├── config/       # DB config, sync
│       ├── controllers/  # Route handlers
│       ├── middleware/    # Express middleware
│       ├── models/       # Sequelize models
│       ├── routes/       # API routes
│       ├── services/     # Business logic
│       ├── utils/        # Helpers
│       └── server.js     # Entry point
├── frontend/
│   └── src/
│       ├── components/   # Reusable UI components
│       ├── pages/        # Page-level components
│       ├── services/     # API service layer
│       ├── styles/       # CSS
│       ├── App.js        # Root component
│       └── index.js      # Entry point
```

## What's Been Done
- Project setup (full stack scaffolding)
- "Add Manually" button for proposals
- Basic project configuration and cleanup
- **Phase 1: AI Requirement Extraction & Proposal Generator** (completed 2026-05-27):
  - New models: `RfpDocument`, `GeneratedProposal`
  - New AI functions: `extractRequirements()`, `generateProposal()` in aiService.js
  - New controller: `rfpDocumentController.js` with 9 endpoints
  - New routes: `/api/rfp-documents/*`
  - New pages: `RfpAnalyzerUpload`, `RfpAnalysis`, `ProposalGenerator`
  - Updated Dashboard with "RFPs Analyzed" stat and "Analyze RFP" button
  - Updated sidebar navigation with "RFP Analyzer" link
  - Full CSS styles for analyzer pages
- **Phase 2: RAG-Powered Semantic Search + AI Compliance Checker** (completed 2026-05-28):
  - New model: `DocumentEmbedding` (JSONB embedding vectors, source type/id indexes)
  - New services: `embeddingService.js` (chunking, OpenAI embeddings, cosine similarity search), `searchService.js` (RAG search), `complianceService.js` (AI gap analysis)
  - New controllers: `searchController.js`, `complianceController.js`
  - New routes: `/api/search/*`, `/api/compliance/*`
  - New pages: `SemanticSearch`, `ComplianceChecker`
  - Updated navigation with "Semantic Search" and "Compliance Checker" links
- **Testing Infrastructure** (completed 2026-05-28):
  - `backend/src/app.js` — Express app factory for supertest (rate limiting disabled in test)
  - `backend/__tests__/helpers/mockFactories.js` — Mock factories for all models
  - 267 total tests (205 backend + 62 frontend), 100% pass rate
  - Backend coverage: 73% statements, 62% branches, 73% functions, 73% lines
- **Phase 3: Risk Analyzer + AI Chatbot** (completed 2026-05-28):
  - New models: `RiskAnalysis`, `ChatConversation`, `ChatMessage`
  - New services: `riskService.js` (multi-category risk assessment, profile comparison), `chatService.js` (RAG-grounded chat, title generation, suggested questions)
  - New controllers: `riskController.js` (5 endpoints), `chatController.js` (7 endpoints)
  - New routes: `/api/risk-analysis/*`, `/api/chat/*`
  - New pages: `RiskAnalyzer` (risk matrix, category breakdown, recommendations), `Chatbot` (sidebar + chat area, source citations, typing indicator)
  - Dashboard: 6 stat cards, 4 quick action buttons
  - Navigation: 10 sidebar links across all phases

- **Authentication & RBAC** (completed 2026-05-28):
  - User model with roles (admin, manager, viewer) and status (active, suspended)
  - Auth service: register, login, JWT access/refresh tokens, password change
  - Auth middleware: `authenticate` (JWT validation) + `requireRole` (role-based gating)
  - Auth controller + routes: register, login, refresh, change-password, getMe
  - Frontend: AuthContext, Login/Register pages, ProtectedRoute, API interceptors with token refresh
  - Database migrations for users table + user_id foreign keys on rfps, vendors, rfp_documents, chat_conversations
  - **RBAC enforcement on all routes**: viewer=read-only, manager+=create/update/AI ops, admin=full access
  - **User-scoped data filtering**: controllers filter by `req.user.id` (admins bypass), ownership checks on get/update/delete
  - **Role-based UI**: sidebar hides links based on role, Dashboard actions conditional, route-level ProtectedRoute with roles
  - **Admin user management**: controller + routes for listing users, changing roles, suspending/activating accounts; admin-only access
  - **Frontend admin page**: UserManagement with search, role filter, role change dropdown, suspend/activate toggle
  - Tests: 289 backend + 62 frontend = 351 total, all passing

- **Phase A: Production Hardening — Deployment Blockers** (completed 2026-05-28):
  - AI service error handling: timeout, rate limit (429), upstream (502/504), safe JSON parsing across all 6 AI services
  - Configurable MODEL, AI_TIMEOUT_MS, AI_MAX_INPUT_LENGTH via env vars
  - Guard sync-db.js against production (blocks with error, points to migrations)
  - Structured logging: winston logger (JSON in prod, colorized in dev, silent in test), morgan HTTP request logging
  - Input validation: zod schemas for all 18+ API endpoints, validate/validateQuery/validateParams middleware
  - Tests: 351 total, all passing

- **Phase B: Security Hardening** (completed 2026-05-28):
  - JWT algorithm pinning: HS256 enforced on all sign/verify calls
  - Brute-force protection: auth endpoints rate limited to 10 req/15min per IP
  - Token rotation: refresh tokens blacklisted on use, new pair issued; logout endpoint added
  - In-memory token blacklist with automatic cleanup of expired tokens
  - File upload hardening: PDF magic byte validation (%PDF-), filename sanitization (path traversal, null bytes, special chars)
  - Password policy: min 8 chars + uppercase + lowercase + number; bcrypt rounds increased to 12
  - SSL/TLS: rejectUnauthorized defaults to true in production (configurable via DB_SSL_REJECT_UNAUTHORIZED)
  - Explicit Helmet CSP, HSTS (1 year, preload), X-Frame-Options deny, Referrer-Policy
  - Audit logging: UUID request IDs (X-Request-Id header), userId in error logs, request ID in HTTP logs
  - Dependencies: nodemailer updated to 8.0.9, imap downgraded to 0.8.17 (fixes 4 high-severity CVEs)
  - Remaining: 2 moderate uuid CVEs in Sequelize transitive dep (not exploitable in our usage)
  - Tests: 351 total, all passing

- **Phase C: Production Infrastructure** (completed 2026-05-28):
  - Complete `.env.example` files: backend (all vars including AI_MODEL, AI_TIMEOUT_MS, AI_MAX_INPUT_LENGTH, EMBEDDING_MODEL, LOG_LEVEL, DB_SSL_REJECT_UNAUTHORIZED) and frontend (REACT_APP_API_URL)
  - Health check endpoints: `/api/healthz` (liveness), `/api/ready` (readiness with DB ping), `/api/health` (backward compat)
  - Docker: multi-stage backend Dockerfile (node:20-alpine, non-root user, healthcheck), multi-stage frontend Dockerfile (build + nginx:alpine), `.dockerignore` files
  - `docker-compose.yml`: postgres:16-alpine with healthcheck, backend with env_file + depends_on, frontend with nginx proxy
  - `frontend/nginx.conf`: SPA fallback, `/api` reverse proxy to backend:5000, static asset caching, security headers
  - PM2: `ecosystem.config.js` with cluster mode, max instances, 512M memory restart
  - GitHub Actions CI: `.github/workflows/ci.yml` with parallel backend-tests + frontend-tests jobs, Node.js 20, npm caching
  - Frontend API config: `REACT_APP_API_URL` used in axios baseURL, configurable at build time
  - Tests: 351 total, all passing

- **Proposal Export to PDF/DOCX** (completed 2026-05-28):
  - New service: `exportService.js` with `generatePdf()` (pdfkit) and `generateDocx()` (docx library)
  - Professional document rendering: title page, all 12 proposal sections, tables, page numbers
  - New endpoint: `GET /rfp-documents/:docId/proposals/:id/export?format=pdf|docx`
  - Zod validation for format query param
  - Frontend: "Export PDF" and "Export DOCX" buttons on ProposalGenerator page with blob download
  - New API method: `exportProposal()` with responseType blob
  - Tests: 375 total (313 backend + 62 frontend), all passing

- **Dashboard Analytics & Charts** (completed 2026-05-28):
  - New backend: `analyticsController.js` + `analyticsRoutes.js` with `GET /api/analytics`
  - Server-side aggregation: RFP status counts, risk level distribution, proposal source breakdown, 30-day activity timeline, budget stats, avg proposal score
  - User-scoped data (admins see all, others see own)
  - Frontend: Recharts library with 5 chart types:
    - Donut chart: RFP status breakdown (color-coded by status)
    - Horizontal bar chart: Risk level distribution (low/medium/high/critical)
    - Area chart: 30-day activity timeline (RFPs, documents, proposals, risks)
    - Pie chart: Proposal source breakdown (email/pdf/manual)
    - Bar chart: Document analysis status
  - Budget highlight bar with total/average budget
  - Summary stat cards: 6 key metrics
  - Responsive CSS with mobile breakpoints
  - Tests: 380 total (318 backend + 62 frontend), all passing

- **Background Job Queue** (completed 2026-05-28):
  - `pg-boss` PostgreSQL-based job queue — no Redis needed, uses existing DB
  - `jobQueue.js` service: init, enqueue, getJobById, worker registration, graceful shutdown
  - Three async job types: `extract-requirements`, `generate-proposal`, `analyze-risks`
  - Workers: process AI calls in background, update DB status on success/error, retry support (2 retries)
  - Controllers updated: return 202 Accepted with `jobId` when queue available, synchronous fallback when unavailable
  - `GET /api/jobs/:id` endpoint: check job state (created/active/completed/failed)
  - Frontend: `useJobPoller` hook with 2s polling interval, auto-refresh on completion
  - Updated 4 pages (RfpAnalyzerUpload, RfpAnalysis, ProposalGenerator, RiskAnalyzer) to handle async responses
  - pg-boss mock for test environment (`moduleNameMapper` in jest config)
  - Tests: 392 total (330 backend + 62 frontend), all passing

- **Email Notification System** (completed 2026-05-28):
  - New model: `Notification` (type, recipientEmail, recipientType, entityType/entityId, status, metadata, sentAt)
  - HTML email templates: `emailTemplates.js` with 5 templates (rfpSentToVendor, proposalReceived, rfpStatusChanged, riskAnalysisComplete, extractionComplete)
  - Layout system with brand header, badge/button helpers, plain text fallback for each template
  - `notificationService.js`: queue-first delivery (pg-boss) with synchronous fallback, Notification record tracking, non-blocking (never throws)
  - Event-driven triggers wired into: `rfpController.sendRfpToVendors`, `proposalController.fetchAndProcessEmails`, `jobQueue` workers (extraction + risk analysis complete)
  - New endpoints: `GET /api/notifications` (paginated, filterable by type/status), `GET /api/notifications/stats` (totals, by-type breakdown, 7-day count)
  - Frontend: Notifications page with stats cards, type/status filters, paginated list, sidebar nav link
  - Tests: 410 total (348 backend + 62 frontend), all passing

- **Production Readiness Audit & Fixes** (completed 2026-05-28):
  - **Authorization hardening**: Added ownership checks (userId via parent RFP/RfpDocument) to all unprotected endpoints:
    - proposalController: createProposal, parseProposal, uploadProposal, listProposals (scoped via Rfp include), getProposal
    - riskController: analyzeRisks, getRiskAnalysis, listRiskAnalyses (scoped via RfpDocument include), compareRisks, deleteRiskAnalysis
    - rfpDocumentController: listGeneratedProposals, getGeneratedProposal, updateGeneratedProposal, exportProposal
  - **Notifications table migration**: `20260529000001-create-notifications-table.js` with indexes on recipient_id, type, status, entity_type+entity_id, created_at
  - **Cosine similarity fix**: Division by zero guard in `embeddingService.cosineSimilarity()` — returns 0 when either vector has zero magnitude
  - **Embedding search scalability**: Added `MAX_SEARCH_ROWS` env-configurable cap (default 5000) with `ORDER BY created_at DESC` to prevent full table load
  - **Database indexes migration**: `20260529000002-add-missing-indexes.js` — 9 FK indexes + 6 status column indexes across all tables
  - **Pagination on all list endpoints**: All 6 list endpoints (rfps, vendors, proposals, rfp-documents, risk-analyses, chat conversations) now use `findAndCountAll` with `page`/`limit` query params (default 20, max 100), returning `{ data, total, page, limit }`
  - Frontend updated to handle paginated response shape across all pages
  - Tests: 410 total (348 backend + 62 frontend), all passing

- **Comprehensive Production Audit & Final Fixes** (completed 2026-05-29):
  - 4 parallel deep-dive audits: backend API, frontend integration, AI/DB layer, security/infrastructure
  - **Sequelize bug fix**: searchController `indexAll` used array syntax `{ status: [...] }` without `Op.in` — fixed with proper `{ [Op.in]: [...] }` and added missing `Op` import
  - **Analytics security**: Non-admin users could see cross-user Proposal/RiskAnalysis counts — fixed with scoped includes through parent Rfp/RfpDocument associations
  - **Embedding service hardening**: 
    - Chunking: removed dead `\n` search after whitespace collapse (only sentence-boundary breaks work)
    - Cosine similarity: added `Array.isArray` + length-mismatch validation (returns 0 for invalid input)
    - Transaction safety: `indexDocument` destroy+bulkCreate now wrapped in `sequelize.transaction()` to prevent race conditions
  - **bcrypt consistency**: Password change used 10 rounds vs registration 12 rounds — fixed to 12 across all paths
  - **Request ID spoofing**: Removed client override of X-Request-Id — always server-generated UUID
  - **RAG error logging**: chatService silent `catch {}` on RAG search failure replaced with `logger.warn()` 
  - **Unused import cleanup**: Removed `GeneratedProposal` import from analyticsController (not used)
  - Tests: 410 total (348 backend + 62 frontend), all passing

- **Final Production Audit — 5-Agent Deep Dive** (completed 2026-05-29):
  - 5 parallel audits: Code Quality, DevOps, Security, Frontend UX, Testing & Observability
  - **CRITICAL access control fixes**: Added `required: true` to Sequelize includes with `where` clauses in:
    - proposalController `listProposals` — Rfp include (prevented non-admin users from seeing all proposals)
    - riskController `listRiskAnalyses` — RfpDocument include (same access control bypass)
    - riskController `compareRisks` — RfpDocument include (same pattern)
  - **Sync fallback error handling**: riskController now updates riskAnalysis status to "failed" when sync fallback throws (was stuck in "analyzing" forever)
  - **Session invalidation on password change**: authService `changePassword` now blacklists the current access token and returns fresh tokens, forcing re-authentication
  - **Input validation**: searchController `indexDocument` now rejects invalid `sourceId` (NaN/negative); notificationController pagination params clamped with `Math.max(1, ...)`
  - **nginx.conf hardening**: Added gzip compression (6 content types), proxy timeouts (10s connect, 120s read/send), client_max_body_size 25m, X-XSS-Protection, Referrer-Policy, Permissions-Policy headers
  - **PM2 config**: Added min_uptime, kill_timeout, listen_timeout, log file paths, merge_logs
  - **Frontend test script**: Added `"test": "react-scripts test"` to frontend package.json
  - **.env.example**: Added APP_URL, IMAP_PORT, MAX_SEARCH_ROWS documentation
  - Tests: 411 total (349 backend + 62 frontend), all passing

- **pg-boss v12 Migration — Job Queue Restored** (completed 2026-08-25, branch `fix/pg-boss-v12-migration`):
  - **Root cause**: `jobQueue.js` was written against the pg-boss v9 API while `package.json` pins `^12.18.2`. `require('pg-boss')` returns a module object, not a constructor, so `start()` threw `PgBoss is not a constructor`. The synchronous fallback swallowed the failure — **every AI operation had been running on the request thread and was never actually queued.** The async job path had never executed in this project's history.
  - Six breaking changes, not just the import:
    - Named export: `const { PgBoss } = require('pg-boss')`
    - Constructor no longer accepts `retryLimit`/`retryDelay`/`expireInMinutes`/`archiveCompletedAfterSeconds`/`deleteAfterDays` (now per-queue); `monitorStateIntervalMinutes` → `monitorIntervalSeconds`
    - `createQueue()` required before `send()`/`work()`; idempotent (`ON CONFLICT DO NOTHING`), so it runs on every startup for all 4 queues
    - Worker options: `teamSize`/`teamConcurrency` → `batchSize`/`localConcurrency`
    - **`work()` handlers now receive an ARRAY of jobs** — all 4 workers changed to `async ([job]) => {...}`. This is the one that silently breaks every job if missed.
    - `getJobById()` is queue-scoped (`name, id`); the wrapper searches known queues since `GET /api/jobs/:id` only carries an id
  - Added `QUEUE_OPTIONS` / `WORK_OPTIONS` constants; `notificationService.registerWorker()` creates its own queue
  - `__tests__/helpers/pgBossMock.js` updated to mirror the v12 surface (named export, `createQueue`)
  - Verified against a live queue: 4 queues created, a job flowed into the analyze-risks worker and failed at the expected point, `GET /api/jobs/:id` returned its status

- **First Full E2E Run + Spec Fix** (completed 2026-08-25):
  - First Playwright run of the suite: 16 tests, 12 passed / 4 failed — all 4 in `02_user_management.spec.js`. All AI specs (03, 04, 05, 06) passed, confirming the restored async queue works end-to-end with real OpenAI calls.
  - **Root cause**: selector referenced a placeholder that does not exist — `input[placeholder="Search users..."]` vs the actual `"Search by name or email..."`
  - **Cascade**: Playwright restarts the worker after a failure, re-evaluating the module-level `manager_${Date.now()}` email, so the 3 remaining tests searched for a user that was never created (proven by 4 distinct timestamps ~33s apart). The app was not at fault — duplicate emails are correctly rejected with 409.
  - Fixed the selector and added `test.describe.configure({ mode: 'serial' })` to declare the cross-test dependency
  - **Running e2e**: both servers must be up. The checked-in `playwright.config.js` `webServer` block sets `NODE_ENV=test`, which makes `jobQueue.start()` return `false` and disables the queue — run against a dev-mode backend to exercise the async path.
  - Tests: 563 total (501 backend + 62 frontend), all passing; 16 e2e, all passing

## Known Open Issues
- **`RfpList.js:42`** shows "Create New RFP" to viewers, who get a 403 on submit. `Dashboard.js:67` gates the same link correctly behind `isManagerOrAdmin`.
- **Migration drift**: all 14 tables exist but `SequelizeMeta` is empty — the dev schema was created by `sync-db`, not migrations. `npm run migrate` has never been proven against a fresh database and would fail on already-existing tables. This is the documented deploy path, so it needs a baseline before any real deployment.
- **`01_auth.spec.js` and `03_rfp_lifecycle.spec.js`** share the same undeclared cross-test state (module-level `Date.now()`) without `serial` mode. They pass today only because nothing in them has failed yet; the first failure will cascade identically.
- **`backend/.env`** holds a live OpenAI key and a Gmail app password in plaintext. It is gitignored (not committed), but consider rotation.

## What's Next (Post-MVP Enhancements)
- Webhook integrations (Slack, Microsoft Teams)
- Scheduled RFP deadline reminders
- Vendor portal for self-service proposal submission
- Multi-language support

## Session Log
- **2026-05-27:** Session context file created. Phase 1 implemented (AI Requirement Extraction + Proposal Generator). All files compile successfully.
- **2026-05-28:** Phase 2 implemented (RAG Search + Compliance). Full test infrastructure created (267 tests). Phase 3 implemented (Risk Analyzer + AI Chatbot). All 267 tests pass. Frontend compiles successfully.
- **2026-05-28 (session 2):** Authentication & RBAC fully implemented. requireRole applied to all routes. User-scoped data filtering in all controllers. Role-based frontend UI. Admin user management (backend + frontend). 351 total tests (289 backend + 62 frontend), all pass.
- **2026-05-28 (session 3):** Phase A (deployment blockers) and Phase B (security hardening) completed. AI service error handling across all services, structured logging, zod validation, JWT hardening, token rotation, file upload security, password policy, CSP headers, audit logging, dependency updates. 351 tests, all pass.
- **2026-05-28 (session 4):** Phase C (production infrastructure) completed. .env.example files, health endpoints, Dockerfiles + docker-compose, nginx config, PM2 cluster config, GitHub Actions CI pipeline. 351 tests, all pass. All three production-readiness phases (A, B, C) complete.
- **2026-05-28 (session 5):** Proposal export (PDF/DOCX). Dashboard analytics with Recharts (5 chart types, server-side aggregation). Background job queue with pg-boss (3 async AI job types, polling frontend, sync fallback). Email notification system (5 HTML templates, queue-first delivery, event triggers in 3 controllers, notification history page). 410 tests (348 backend + 62 frontend), all pass.
- **2026-05-28 (session 6):** Production readiness audit & fixes. Authorization hardening across proposalController, riskController, rfpDocumentController (ownership checks via parent entity). Notifications table migration. Cosine similarity division-by-zero fix. Embedding search scalability cap. Database indexes migration (15 indexes). Pagination on all 6 list endpoints with frontend updates. 410 tests, all pass.
- **2026-05-29 (session 7):** Comprehensive production audit via 4 parallel deep-dives (backend API, frontend, AI/DB, security). Fixed: Sequelize Op.in bug in searchController, analytics cross-user data leak, embeddingService chunking/validation/transaction bugs, bcrypt rounds inconsistency, request ID spoofing, silent RAG error swallowing. 410 tests, all pass.
- **2026-05-29 (session 8):** Final 5-agent deep-dive audit (code quality, DevOps, security, frontend UX, testing/observability). Fixed 3 CRITICAL access control bypasses (missing `required: true` on Sequelize includes in proposalController + riskController). Fixed sync fallback error handling, session invalidation on password change, input validation gaps. Hardened nginx (gzip, timeouts, security headers), PM2 config, .env.example. 411 tests (349 backend + 62 frontend), all pass. System production-ready.
- **2026-05-30 (session 9):** RBAC redesign for production. Removed auto-admin-on-first-registration (race condition, insecure). Added `scripts/setup-admin.js` CLI for admin bootstrapping (`npm run setup:admin`). Self-registration always assigns viewer role. Added `ALLOW_SELF_REGISTRATION` env var toggle (default true, set 'false' to disable). Added `POST /api/admin/users` endpoint for admin-created users with role assignment. Frontend UserManagement page updated with "Create User" form. 418 tests (356 backend + 62 frontend), all pass.
- **2026-08-25 (session 10):** Ran the full stack locally and found the job queue had been silently disabled since it was written — `jobQueue.js` targeted the pg-boss v9 API against the installed v12.18.2, so every AI operation fell back to synchronous processing. Migrated to the v12 API (6 breaking changes; the array-based `work()` handler is the dangerous one). Then ran the Playwright e2e suite for the first time: 12/16 passed, and the 4 failures traced to a wrong selector in `02_user_management.spec.js` cascading through worker restarts. Fixed both. 563 tests (501 backend + 62 frontend) + 16 e2e, all pass. Work committed on branch `fix/pg-boss-v12-migration` (2 commits, not merged to main). See **Known Open Issues** above.
