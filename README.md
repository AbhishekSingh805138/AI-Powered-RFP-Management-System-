# AI-Powered RFP Management System

A full-stack, AI-powered Request for Proposal (RFP) management platform that automates the entire RFP lifecycle — from document analysis and requirement extraction to proposal generation, compliance checking, risk assessment, and vendor comparison. Built with React, Node.js/Express, PostgreSQL, and OpenAI.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Core Features](#core-features)
  - [RFP Management](#1-rfp-management)
  - [AI Requirement Extraction](#2-ai-requirement-extraction)
  - [AI Proposal Generator](#3-ai-proposal-generator)
  - [Semantic Search (RAG)](#4-semantic-search-rag-pipeline)
  - [Compliance Checker](#5-compliance-checker)
  - [Risk Analyzer](#6-risk-analyzer)
  - [AI Chatbot](#7-ai-chatbot)
  - [Vendor Management](#8-vendor-management)
  - [Proposal Comparison Engine](#9-proposal-comparison-engine)
  - [Email Integration](#10-email-integration)
  - [Notification System](#11-notification-system)
  - [Dashboard & Analytics](#12-dashboard--analytics)
  - [User Management & RBAC](#13-user-management--rbac)
  - [Document Export](#14-document-export-pdfdocx)
- [Data Flow](#data-flow)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation & Setup](#installation--setup)
- [Environment Variables](#environment-variables)
- [Database Migrations](#database-migrations)
- [API Reference](#api-reference)
- [Background Job Queue](#background-job-queue)
- [Authentication & Authorization](#authentication--authorization)
- [Deployment Guide](#deployment-guide)
- [Testing](#testing)
- [Future Improvements](#future-improvements)

---

## Project Overview

Managing RFPs manually is time-consuming and error-prone. This system uses AI to automate the heavy lifting:

1. **Upload** an RFP document (PDF) and AI extracts all requirements, deadlines, compliance items, and evaluation criteria.
2. **Generate** a professional, tailored proposal with a single click — complete with technical approach, cost breakdown, timeline, and compliance matrix.
3. **Check compliance** between the RFP requirements and your proposal to identify gaps before submission.
4. **Assess risks** across 6 categories (technical, financial, compliance, timeline, resource, scope) with mitigation strategies.
5. **Search** across all your documents using natural language — powered by vector embeddings and RAG.
6. **Chat** with an AI assistant that has full context of your RFP data.
7. **Compare** vendor proposals side-by-side with AI-powered scoring and recommendations.
8. **Export** proposals as professionally formatted PDF or DOCX documents.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Frontend (React SPA)                         │
│   Dashboard │ RFP Analyzer │ Search │ Compliance │ Risk │ Chatbot  │
└────────────────────────────┬────────────────────────────────────────┘
                             │ REST API (Axios + JWT)
┌────────────────────────────▼────────────────────────────────────────┐
│                     Backend (Node.js / Express)                     │
│                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────────┐ │
│  │   Auth       │  │  Middleware   │  │     Controllers            │ │
│  │  (JWT +      │  │  (Helmet,    │  │  rfp, vendor, proposal,    │ │
│  │   RBAC)      │  │   CORS,      │  │  rfpDocument, search,      │ │
│  │             │  │   Rate Limit, │  │  compliance, risk, chat,   │ │
│  │             │  │   Validation) │  │  analytics, admin, notify  │ │
│  └─────────────┘  └──────────────┘  └─────────────┬──────────────┘ │
│                                                     │               │
│  ┌──────────────────────────────────────────────────▼──────────────┐│
│  │                        Services Layer                           ││
│  │                                                                 ││
│  │  aiService ─── OpenAI GPT ──► Parse, Extract, Generate, Compare││
│  │  embeddingService ── OpenAI Embeddings ──► Index, Search        ││
│  │  searchService ─── RAG Pipeline ──► Query → Retrieve → Generate││
│  │  complianceService ──► Gap Analysis                             ││
│  │  riskService ──► 6-Category Risk Assessment                     ││
│  │  chatService ──► RAG-Grounded Conversations                     ││
│  │  exportService ──► PDF / DOCX Generation                        ││
│  │  emailService ──► SMTP Send / IMAP Receive                      ││
│  │  notificationService ──► Queue-First Email Delivery             ││
│  │  authService ──► JWT Tokens + Password Hashing                  ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌─────────────────────┐    ┌──────────────────────────────────────┐│
│  │   Job Queue          │    │        PostgreSQL Database           ││
│  │   (pg-boss)          │    │                                      ││
│  │                      │    │  Users, RFPs, Vendors, Proposals,    ││
│  │  extract-requirements│    │  RfpDocuments, GeneratedProposals,   ││
│  │  generate-proposal   │◄──►│  DocumentEmbeddings, RiskAnalyses,  ││
│  │  analyze-risks       │    │  ChatConversations, ChatMessages,    ││
│  │  send-notification   │    │  Comparisons, Notifications          ││
│  └─────────────────────┘    └──────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **pg-boss** for job queue | Uses the existing PostgreSQL database — no Redis dependency needed |
| **JSONB columns** for AI outputs | Flexible schema for evolving AI response structures |
| **Synchronous fallback** | If the job queue is unavailable, AI operations run synchronously so the app never breaks |
| **In-memory token blacklist** | Sufficient for single-instance deployments; swap for Redis at scale |
| **Overlapping text chunks** | 800-char chunks with 200-char overlap ensure no context is lost at boundaries |

---

## Core Features

### 1. RFP Management

Create RFPs from natural language descriptions. The AI parses your input and structures it into:

- **Line items** with quantities, specifications, and estimated prices
- **Budget** and currency
- **Delivery timeline** with deadlines
- **Payment terms** and warranty requirements
- **Evaluation criteria** with weights

**Workflow:**
1. Write a procurement description in plain English (e.g., *"We need 50 Dell laptops with 16GB RAM, budget $75,000, delivery in 30 days"*)
2. AI structures it into a formal RFP with all fields populated
3. Send the RFP to selected vendors via email
4. Track vendor responses, parse proposals, and compare them

### 2. AI Requirement Extraction

Upload an RFP document (PDF) and AI extracts structured data automatically.

**What gets extracted:**
- Title, issuing organization, RFP reference number
- Submission deadline and key dates
- Budget information (estimated budget, currency, constraints)
- Technical requirements (with priority: mandatory/preferred/optional)
- Compliance requirements (regulatory, legal, certification)
- Deliverables with due dates and acceptance criteria
- Evaluation criteria with percentage weights
- Submission instructions (format, page limit, required sections)
- Risks identified in the document
- Special conditions and terms

**How it works:**
1. PDF is uploaded and text is extracted using `pdf-parse`
2. File is validated (PDF magic bytes, filename sanitized, 20MB limit)
3. Extracted text is sent to OpenAI with a structured prompt
4. AI returns JSON with all fields populated
5. Processing runs as a background job (pg-boss) with 2-second polling on the frontend

### 3. AI Proposal Generator

Generate a complete, professional proposal tailored to the RFP requirements.

**Input:** Extracted RFP data + your company profile (name, industry, expertise, team size, certifications, differentiators)

**Generated sections:**

| Section | Contents |
|---------|----------|
| Executive Summary | High-level overview of your response |
| Understanding of Requirements | Demonstrates comprehension of the RFP |
| Technical Approach | Methodology, solution components, technology stack |
| Scope of Work | Phased delivery plan with activities and deliverables per phase |
| Timeline | Milestones with dates and dependencies |
| Team Composition | Roles, responsibilities, and qualifications |
| Cost Breakdown | Line items, totals, payment schedule, assumptions |
| Compliance Matrix | Requirement-by-requirement compliance mapping |
| Risk Mitigation | Identified risks with impact assessment and mitigation plans |
| Differentiators | What sets your proposal apart |
| Past Performance | Relevant experience and track record |
| Terms & Conditions | Commercial and legal terms |

**Features:**
- Each section is individually editable after generation
- Version tracking (v1, v2, ...) with regeneration capability
- Finalize to lock edits
- Export to professional PDF or DOCX

### 4. Semantic Search (RAG Pipeline)

Search across all your RFP documents, proposals, and generated content using natural language.

**How the RAG pipeline works:**

```
User Query: "What are the security requirements for the cloud migration project?"
     │
     ▼
┌─────────────────────┐
│  1. Embed Query      │  Generate vector embedding of the question
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  2. Vector Search    │  Find top-K most similar document chunks
│     (Cosine Sim.)    │  from the embeddings database
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  3. Build Context    │  Assemble relevant chunks into a context window
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  4. Generate Answer  │  AI generates a grounded answer citing sources
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  5. Return Results   │  Answer + source documents + matching passages
└─────────────────────┘
```

**Indexing process:**
1. Documents are split into overlapping chunks (800 chars, 200-char overlap)
2. Chunks are broken at sentence boundaries for coherence
3. Each chunk gets a vector embedding via OpenAI `text-embedding-3-small`
4. Embeddings are stored in PostgreSQL (JSONB)
5. Indexing is atomic — old embeddings are replaced in a transaction

**Search results include:**
- AI-generated answer with citations
- Source documents with relevance scores
- Individual matching passages with similarity percentages
- Filter by source type (RFP documents, proposals, generated proposals)

### 5. Compliance Checker

AI-powered gap analysis comparing RFP requirements against your proposal.

**Input options:**
- Select an RFP document + a generated proposal, OR
- Select an RFP document + paste proposal text

**Output:**

| Analysis Area | Details |
|---------------|---------|
| **Overall Score** | 0-100 compliance percentage |
| **Status** | Compliant / Partially Compliant / Non-Compliant / Exceeds |
| **Technical Compliance** | Per-requirement: status, proposal response, gaps, severity |
| **Regulatory Compliance** | Mandatory vs. optional items, evidence of compliance |
| **Deliverable Coverage** | Each deliverable: addressed, partial, or missing |
| **Budget Compliance** | RFP budget vs. proposal cost, over/under/within analysis |
| **Timeline Compliance** | RFP deadline vs. proposal timeline, feasibility |
| **Risk Assessment** | Compliance risks with severity (critical/major/minor) |
| **Strengths** | What the proposal does well |
| **Improvements** | Specific areas to strengthen before submission |

### 6. Risk Analyzer

Multi-category AI risk assessment for RFPs and proposals.

**6 Risk Categories:**

| Category | What it assesses |
|----------|-----------------|
| **Technical** | Technology complexity, integration challenges, technical debt |
| **Financial** | Budget adequacy, cost overrun potential, payment risks |
| **Compliance** | Regulatory gaps, certification requirements, legal exposure |
| **Timeline** | Schedule feasibility, dependency chains, deadline pressure |
| **Resource** | Team availability, skill gaps, capacity constraints |
| **Scope** | Requirements clarity, scope creep potential, change management |

**For each risk identified:**
- Unique ID, title, and description
- Severity level (critical / high / medium / low)
- Likelihood assessment
- Impact analysis
- Affected requirements
- Mitigation strategy
- Contingency plan

**Report includes:**
- Overall risk score (0-100) with level classification
- Executive summary
- Risk matrix (severity x likelihood)
- Per-category breakdown with individual risks
- Prioritized recommendations (immediate / short-term / long-term)
- Strengths and watch items
- Compare risk profiles across multiple analyses

### 7. AI Chatbot

Conversational AI assistant grounded in your RFP data using RAG.

**How it works:**
1. User sends a message
2. System performs semantic search across all indexed documents
3. Relevant document chunks are retrieved and included in the AI context
4. AI generates a response grounded in your actual data
5. Response includes source citations (document name, type, similarity score)

**Features:**
- Multiple conversation threads with auto-generated titles
- Conversation history (last 10 messages for context)
- Source citations on every response
- Suggested follow-up questions (AI-generated based on conversation context)
- Archive and delete conversations
- Typing indicator during response generation

**Example queries:**
- *"What are the key requirements for the healthcare RFP?"*
- *"Compare the technical approaches in our last two proposals"*
- *"What compliance certifications are needed for the government contract?"*

### 8. Vendor Management

Full CRUD for managing your vendor database.

- Name, email, company, phone, category, address, notes
- Search across name, email, and company
- Filter by category
- Used when sending RFPs and tracking proposals

### 9. Proposal Comparison Engine

AI-powered side-by-side comparison of vendor proposals for an RFP.

**Scoring criteria (6 dimensions):**
1. Price Competitiveness
2. Specification Compliance
3. Delivery Timeline
4. Payment Terms
5. Warranty Coverage
6. Overall Value

**Output:**
- Score matrix with all vendors across all criteria
- Recommended vendor with confidence level and reasoning
- Executive summary
- Caveats and considerations

### 10. Email Integration

Two-way email integration for the RFP workflow.

**Outbound (SMTP):**
- Send RFP invitations to selected vendors
- Track email delivery status per vendor (pending/sent/failed/delivered)
- Professional HTML email templates

**Inbound (IMAP):**
- Fetch vendor proposal responses from email inbox
- Auto-extract text from email body
- Parse PDF attachments automatically
- Mark processed emails as read

### 11. Notification System

Event-driven email notifications with queue-first delivery.

**Notification types:**

| Event | Trigger |
|-------|---------|
| RFP Sent to Vendor | When an RFP is emailed to vendors |
| Proposal Received | When a new proposal arrives via email |
| RFP Status Changed | When an RFP status is updated |
| Risk Analysis Complete | When a risk analysis background job finishes |
| Extraction Complete | When requirement extraction finishes |

**Features:**
- Queued via pg-boss with synchronous fallback
- Audit trail for every notification (type, recipient, status, timestamps)
- Dashboard with stats: total, sent, failed, queued, last 7 days
- Filterable by type and status with pagination

### 12. Dashboard & Analytics

Real-time analytics dashboard with interactive charts.

**Summary cards:** RFPs Analyzed, Total RFPs, Vendors, Proposals Received, Risk Analyses, Avg Proposal Score

**Charts (Recharts):**
- **RFP Status Breakdown** — Donut chart showing draft/sent/evaluating/awarded/closed
- **Risk Level Distribution** — Horizontal bar chart (low/medium/high/critical)
- **30-Day Activity Timeline** — Area chart tracking RFPs, documents, proposals, and risk analyses
- **Proposal Sources** — Pie chart (email/pdf/manual)
- **Document Analysis Status** — Bar chart of upload/extraction statuses

**Budget highlight bar** showing total budget across all RFPs and average per RFP.

All analytics are user-scoped (admins see everything, others see only their own data).

### 13. User Management & RBAC

Three-tier role-based access control system.

| Permission | Admin | Manager | Viewer |
|------------|-------|---------|--------|
| View RFPs, Proposals, Vendors | Yes | Yes | Yes |
| Create/Edit RFPs | Yes | Yes | No |
| Create/Edit Vendors | Yes | Yes | No |
| AI Analysis (Extract, Generate) | Yes | Yes | No |
| Compliance Checker | Yes | Yes | No |
| Risk Analyzer | Yes | Yes | No |
| Semantic Search | Yes | Yes | Yes |
| AI Chatbot | Yes | Yes | Yes |
| View Analytics | Yes | Yes | No |
| Manage Users | Yes | No | No |

**Admin features:**
- Create users with role assignment
- Change user roles and suspend/activate accounts
- Reset passwords
- Search and filter users

**Security highlights:**
- Passwords: bcrypt (12 salt rounds), policy enforced (8+ chars, upper/lower/number)
- JWT: HS256 algorithm pinned, 15-min access token, 7-day refresh token
- Token rotation: Refresh tokens blacklisted on use
- Session invalidation on password change
- Brute-force protection: 10 requests per 15 minutes on auth endpoints

**Admin bootstrap:**
```bash
npm run setup:admin -- --email admin@example.com --password SecurePass1 --firstName Admin --lastName User
```

### 14. Document Export (PDF/DOCX)

Export generated proposals as professionally formatted documents.

**PDF features:**
- A4 page size with consistent margins
- Title page with company name, date, and version
- All 12 proposal sections with proper formatting
- Tables for team composition, cost breakdown, milestones, compliance matrix
- Page numbers in footer

**DOCX features:**
- Same content and structure as PDF
- Calibri font with styled headings
- Tables with alternating row colors
- Compatible with Microsoft Word, Google Docs, LibreOffice

---

## Data Flow

### End-to-End RFP Lifecycle

```
                          ┌──────────────────┐
                          │   Upload RFP PDF  │
                          └────────┬─────────┘
                                   │
                          ┌────────▼─────────┐
                          │  Extract Text     │
                          │  (pdf-parse)      │
                          └────────┬─────────┘
                                   │
                          ┌────────▼─────────┐
                          │  AI Extraction    │──── Background Job
                          │  (Requirements,   │     (pg-boss)
                          │   Compliance,     │
                          │   Deliverables)   │
                          └────────┬─────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                     │
    ┌─────────▼──────┐  ┌────────▼─────────┐  ┌───────▼────────┐
    │  Index for      │  │  Generate         │  │  Risk Analysis  │
    │  Semantic Search│  │  Proposal (AI)    │  │  (6 categories) │
    │  (Embeddings)   │  └────────┬─────────┘  └───────┬────────┘
    └─────────┬──────┘           │                     │
              │         ┌────────▼─────────┐           │
              │         │  Compliance Check │           │
              │         │  (Gap Analysis)   │           │
              │         └────────┬─────────┘           │
              │                  │                      │
              │         ┌────────▼─────────┐           │
              │         │  Export PDF/DOCX  │           │
              │         └──────────────────┘           │
              │                                        │
    ┌─────────▼──────────────────────────────────────▼─┐
    │              RAG-Powered Chat & Search             │
    │    (Query → Embed → Retrieve → Generate Answer)   │
    └───────────────────────────────────────────────────┘
```

### Vendor Proposal Flow

```
  Create RFP ──► Send to Vendors (Email) ──► Vendors Respond
                                                    │
              ┌─────────────────────────────────────┘
              │
    ┌─────────▼──────────┐
    │  Receive Proposals   │
    │  (Email/PDF/Manual)  │
    └─────────┬──────────┘
              │
    ┌─────────▼──────────┐
    │  AI Parse Proposals  │
    │  (Extract pricing,   │
    │   compliance, terms)  │
    └─────────┬──────────┘
              │
    ┌─────────▼──────────┐
    │  Compare & Score     │
    │  (6 criteria matrix) │
    └─────────┬──────────┘
              │
    ┌─────────▼──────────┐
    │  AI Recommendation   │
    │  (vendor + reasoning)│
    └──────────────────────┘
```

---

## Tech Stack

### Backend

| Technology | Purpose |
|------------|---------|
| Node.js 20 | Runtime |
| Express 4 | Web framework |
| Sequelize 6 | PostgreSQL ORM |
| PostgreSQL 16 | Primary database |
| OpenAI API | GPT-4o-mini for AI, text-embedding-3-small for vectors |
| pg-boss | PostgreSQL-based job queue |
| JWT (jsonwebtoken) | Authentication tokens |
| bcryptjs | Password hashing |
| Multer | File upload handling |
| pdf-parse | PDF text extraction |
| PDFKit | PDF generation |
| docx | DOCX generation |
| Nodemailer | SMTP email sending |
| imap + mailparser | Email retrieval and parsing |
| Helmet | Security headers |
| Zod | Request validation |
| Winston | Structured logging |
| Morgan | HTTP request logging |

### Frontend

| Technology | Purpose |
|------------|---------|
| React 18 | UI framework |
| React Router 6 | Client-side routing |
| Axios | HTTP client with interceptors |
| Recharts | Dashboard charts and visualizations |
| CSS3 | Styling (responsive design) |

### Infrastructure

| Technology | Purpose |
|------------|---------|
| Docker | Containerization (multi-stage builds) |
| Docker Compose | Multi-service orchestration |
| Nginx | Frontend serving, API reverse proxy |
| PM2 | Production process manager (cluster mode) |
| GitHub Actions | CI/CD pipeline |
| Playwright | E2E testing |
| Jest + Supertest | Backend unit/integration testing |
| React Testing Library | Frontend component testing |

---

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── config/               # Database config, sync utility
│   │   ├── controllers/          # 13 route handler modules
│   │   ├── middleware/            # Auth, validation, error handling, security
│   │   ├── models/               # 13 Sequelize models + associations
│   │   ├── routes/               # 13 route modules
│   │   ├── services/             # 11 business logic services
│   │   ├── utils/                # Winston logger
│   │   ├── migrations/           # 5 database migrations
│   │   ├── app.js                # Express app setup
│   │   └── server.js             # Entry point
│   ├── scripts/
│   │   ├── setup-admin.js        # Bootstrap admin account
│   │   └── create-test-pdf.js    # Generate test PDF
│   ├── __tests__/                # 500+ backend tests
│   ├── Dockerfile
│   ├── ecosystem.config.js       # PM2 cluster config
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/                # 17 page components
│   │   ├── components/           # ProtectedRoute, ErrorBoundary
│   │   ├── contexts/             # AuthContext (token management)
│   │   ├── hooks/                # useJobPoller (async job tracking)
│   │   ├── services/             # Axios API client (60+ endpoints)
│   │   ├── styles/               # Responsive CSS
│   │   └── App.js                # Routing + layout
│   ├── Dockerfile
│   ├── nginx.conf                # SPA routing + API proxy
│   └── package.json
│
├── e2e-tests/                    # Playwright E2E tests
├── .github/workflows/ci.yml     # CI pipeline (3 parallel jobs)
├── docker-compose.yml            # Full stack orchestration
└── CLAUDE.md                     # AI assistant context file
```

---

## Installation & Setup

### Prerequisites

- **Node.js** 20+
- **PostgreSQL** 16+
- **OpenAI API key** (for AI features)
- **npm** 9+

### 1. Clone the Repository

```bash
git clone <repository-url>
cd rfp-management-system
```

### 2. Setup Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your database credentials, JWT secrets, and OpenAI API key
npm install
```

### 3. Setup Database

```bash
# Create the database
createdb rfp_management

# Run migrations
npm run migrate

# Bootstrap admin account
npm run setup:admin -- --email admin@example.com --password YourSecurePass1 --firstName Admin --lastName User
```

### 4. Setup Frontend

```bash
cd ../frontend
cp .env.example .env
# Edit .env if backend is not on localhost:5000
npm install
```

### 5. Start Development Servers

```bash
# Terminal 1: Backend (with auto-reload)
cd backend
npm run dev

# Terminal 2: Frontend (with hot-reload)
cd frontend
npm start
```

The app will be available at `http://localhost:3000` with the API on `http://localhost:5000`.

---

## Environment Variables

### Backend (`backend/.env`)

```bash
# Server
PORT=5000
NODE_ENV=development

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rfp_management
DB_USER=postgres
DB_PASSWORD=                    # Required
DB_SSL_REJECT_UNAUTHORIZED=true # Set false for self-signed certs

# Authentication
JWT_SECRET=                     # Required - generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_REFRESH_SECRET=             # Required - generate a different secret
ALLOW_SELF_REGISTRATION=true    # Set false to restrict to admin-created accounts

# OpenAI
OPENAI_API_KEY=                 # Required

# AI Configuration (optional - defaults shown)
AI_MODEL=gpt-4o-mini
AI_TIMEOUT_MS=60000
AI_MAX_INPUT_LENGTH=100000
EMBEDDING_MODEL=text-embedding-3-small
MAX_SEARCH_ROWS=5000

# CORS
ALLOWED_ORIGINS=http://localhost:3000

# Application
APP_URL=http://localhost:3000   # Used in email notification links

# Logging
LOG_LEVEL=debug                 # Use "info" in production

# SMTP (for sending emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=                      # Your email
SMTP_PASSWORD=                  # App-specific password
SMTP_FROM=                      # From address

# IMAP (for receiving vendor responses)
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=                      # Your email
IMAP_PASSWORD=                  # App-specific password
```

### Frontend (`frontend/.env`)

```bash
REACT_APP_API_URL=http://localhost:5000/api
```

---

## Database Migrations

The database schema is managed through 5 sequential migrations:

| Migration | Tables/Changes |
|-----------|---------------|
| `initial-schema` | rfps, vendors, rfp_vendors, proposals, comparisons, rfp_documents, generated_proposals, document_embeddings, risk_analyses, chat_conversations, chat_messages |
| `create-users-table` | users (email, password, role, status) |
| `add-user-id-foreign-keys` | Adds user_id FK to rfps, vendors, rfp_documents, chat_conversations |
| `create-notifications-table` | notifications (type, recipient, status, metadata) |
| `add-missing-indexes` | 9 FK indexes + 6 status column indexes for query performance |

```bash
npm run migrate              # Run all pending migrations
npm run migrate:status       # Check migration status
npm run migrate:undo         # Rollback last migration
npm run migrate:undo:all     # Rollback all migrations
```

---

## API Reference

All endpoints are prefixed with `/api`. Protected routes require `Authorization: Bearer <token>` header.

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/register` | Create account | No |
| POST | `/auth/login` | Login, receive tokens | No |
| POST | `/auth/refresh` | Refresh token pair | No |
| POST | `/auth/logout` | Revoke tokens | Yes |
| PUT | `/auth/change-password` | Change password | Yes |
| GET | `/auth/me` | Get current user | Yes |

### RFPs

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| GET | `/rfps` | List RFPs (user-scoped) | All |
| GET | `/rfps/:id` | Get RFP with vendors & proposals | All |
| POST | `/rfps` | Create RFP from natural language | Manager+ |
| PUT | `/rfps/:id` | Update RFP | Manager+ |
| DELETE | `/rfps/:id` | Delete RFP | Admin |
| POST | `/rfps/:id/send` | Send RFP to vendors via email | Manager+ |
| POST | `/rfps/:id/compare` | AI-compare proposals | Manager+ |

### Vendors

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| GET | `/vendors` | List vendors (search, filter) | All |
| POST | `/vendors` | Create vendor | Manager+ |
| PUT | `/vendors/:id` | Update vendor | Manager+ |
| DELETE | `/vendors/:id` | Delete vendor | Admin |

### Proposals

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| GET | `/proposals` | List all proposals | All |
| POST | `/proposals/manual` | Add proposal manually | Manager+ |
| POST | `/proposals/upload` | Upload PDF proposal | Manager+ |
| POST | `/proposals/fetch-emails` | Fetch from IMAP inbox | Manager+ |
| POST | `/proposals/:id/parse` | AI-parse proposal | Manager+ |

### RFP Documents & Generated Proposals

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| POST | `/rfp-documents/upload` | Upload PDF (20MB max) | Manager+ |
| POST | `/rfp-documents/:id/extract` | Extract requirements (async) | Manager+ |
| GET | `/rfp-documents` | List documents | All |
| GET | `/rfp-documents/:id` | Get document with extracted data | All |
| DELETE | `/rfp-documents/:id` | Delete document | Admin |
| POST | `/rfp-documents/:id/generate` | Generate proposal (async) | Manager+ |
| GET | `/rfp-documents/:docId/proposals` | List generated proposals | All |
| PUT | `/rfp-documents/:docId/proposals/:id` | Edit proposal section | Manager+ |
| GET | `/rfp-documents/:docId/proposals/:id/export?format=pdf\|docx` | Export proposal | All |

### Semantic Search

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| POST | `/search` | RAG semantic search | All |
| GET | `/search/stats` | Indexing statistics | All |
| POST | `/search/index-all` | Index all documents | Manager+ |

### Compliance & Risk

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| POST | `/compliance/check` | Run compliance analysis | Manager+ |
| POST | `/risk-analysis` | Run risk analysis (async) | Manager+ |
| GET | `/risk-analysis` | List analyses | All |
| GET | `/risk-analysis/:id` | Get analysis | All |
| POST | `/risk-analysis/compare` | Compare profiles | Manager+ |

### Chat

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| POST | `/chat/conversations` | New conversation | All |
| GET | `/chat/conversations` | List conversations | All |
| POST | `/chat/conversations/:id/messages` | Send message (RAG) | All |
| GET | `/chat/conversations/:id/suggestions` | Get follow-up questions | All |

### Admin & System

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| GET | `/admin/users` | List users | Admin |
| POST | `/admin/users` | Create user with role | Admin |
| PUT | `/admin/users/:id/role` | Change role | Admin |
| PUT | `/admin/users/:id/status` | Suspend/activate | Admin |
| GET | `/analytics` | Dashboard analytics | Yes |
| GET | `/notifications` | Notification history | Yes |
| GET | `/healthz` | Liveness probe | No |
| GET | `/ready` | Readiness probe (DB ping) | No |

---

## Background Job Queue

Long-running AI operations run as background jobs via **pg-boss** (PostgreSQL-based queue).

| Job Type | Trigger | Retry | Timeout |
|----------|---------|-------|---------|
| `extract-requirements` | Upload + extract | 2 | 10 min |
| `generate-proposal` | Generate proposal | 2 | 10 min |
| `analyze-risks` | Run risk analysis | 2 | 10 min |
| `send-notification` | Any notification event | 2 | 10 min |

**Frontend polling:** The `useJobPoller` hook polls `GET /api/jobs/:id` every 2 seconds (max 5 minutes) and refreshes data on completion.

**Graceful fallback:** If pg-boss fails to start, all operations run synchronously. The API returns `200` instead of `202` and the frontend handles both.

---

## Authentication & Authorization

### Token Flow

```
Login ──► Access Token (15 min) + Refresh Token (7 days)
              │
              ▼
         API Requests (Bearer token)
              │
         Token Expired?
              │
     ┌────────┴────────┐
     No                Yes
     │                  │
  Continue          POST /auth/refresh
                        │
                   ┌────┴────┐
                   OK        Fail
                   │          │
              New Tokens   Redirect
              (old revoked) to Login
```

### Security Measures

- JWT algorithm pinned to HS256 (prevents algorithm confusion attacks)
- Refresh token rotation (old token blacklisted on each refresh)
- Session invalidation on password change
- Brute-force protection: 10 auth requests per 15 minutes per IP
- File upload: PDF magic byte validation, filename sanitization
- Request ID tracking (UUID) for audit trails
- Helmet security headers (CSP, HSTS, X-Frame-Options)
- Rate limiting: 100 req/15min general, 20 req/15min for AI endpoints

---

## Deployment Guide

### Docker Compose (Recommended)

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env with production values

# 2. Build and start all services
docker compose up -d --build

# 3. Run database migrations
docker compose exec backend npx sequelize-cli db:migrate

# 4. Create admin account
docker compose exec backend npm run setup:admin -- \
  --email admin@example.com \
  --password YourSecurePass1 \
  --firstName Admin \
  --lastName User
```

The app will be available on port 80 (Nginx serves frontend, proxies `/api` to backend).

### PM2 (Direct Server)

```bash
# Backend
cd backend
npm install --omit=dev
npx sequelize-cli db:migrate
npm run start:prod    # PM2 cluster mode (all CPU cores)

# Frontend
cd frontend
npm install
REACT_APP_API_URL=https://your-domain.com/api npm run build
# Serve build/ directory with Nginx
```

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Generate strong JWT secrets (64+ random bytes each)
- [ ] Configure SSL/TLS for database connection
- [ ] Set `ALLOWED_ORIGINS` to your domain
- [ ] Configure SMTP for email notifications
- [ ] Set `ALLOW_SELF_REGISTRATION=false` if needed
- [ ] Run database migrations
- [ ] Create initial admin account via `setup:admin`
- [ ] Configure Nginx with SSL certificate
- [ ] Set up log rotation for PM2 logs
- [ ] Verify health endpoints: `/api/healthz` and `/api/ready`

---

## Testing

### Backend (Jest + Supertest)

```bash
cd backend
npm test                    # Run all tests
npm run test:coverage       # With coverage report
npm run test:unit           # Unit tests only
npm run test:api            # API/integration tests
npm run test:middleware      # Middleware tests
```

**500+ tests** covering controllers, services, middleware, and models.

### Frontend (React Testing Library)

```bash
cd frontend
npm test                    # 62 tests
```

### E2E (Playwright)

```bash
cd e2e-tests
npm test                    # Headless
npm run test:headed         # Browser visible
npm run test:ui             # Interactive mode
```

### CI Pipeline (GitHub Actions)

Three parallel jobs run on every push to `main` and all PRs:

1. **Backend Tests** — Install, test, coverage report
2. **Frontend Tests** — Install, test, production build verification
3. **E2E Tests** — PostgreSQL service, migrations, Playwright with Chromium

---

## Future Improvements

- **Webhook integrations** — Slack and Microsoft Teams notifications
- **Scheduled reminders** — Automated RFP deadline reminders
- **Vendor portal** — Self-service proposal submission for vendors
- **Multi-language support** — i18n for the frontend
- **Redis for token blacklist** — Scale beyond single-instance deployments
- **pgvector extension** — Native PostgreSQL vector similarity search (replace JSONB embeddings)
- **SSO/OAuth** — SAML and OAuth2 provider integration
- **Audit log UI** — Searchable history of all system actions
- **Template library** — Reusable proposal templates by industry
- **Batch processing** — Process multiple RFP documents simultaneously

---

## License

This project is proprietary. All rights reserved.
