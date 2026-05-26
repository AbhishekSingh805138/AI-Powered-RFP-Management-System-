# AI-Powered RFP Management System

A single-user web application that automates the procurement/RFP workflow using AI. Users describe procurement needs in natural language, the system structures the data, sends RFPs to vendors via email, receives and parses vendor proposals using AI, and produces a scored comparison with a recommended vendor.

## Architecture

```
┌─────────────┐     HTTP/JSON     ┌──────────────────────┐     SQL      ┌────────────┐
│   React SPA  │ ◄──────────────► │  Express.js Backend  │ ◄──────────► │ PostgreSQL │
│  (Port 3000) │                  │     (Port 5000)      │              │            │
└─────────────┘                   └──────────┬───────────┘              └────────────┘
                                             │
                              ┌──────────────┼──────────────┐
                              ▼              ▼              ▼
                        ┌──────────┐  ┌───────────┐  ┌───────────┐
                        │ OpenAI   │  │   SMTP    │  │   IMAP    │
                        │ GPT-4o   │  │ (Send)    │  │ (Receive) │
                        │ mini     │  │           │  │           │
                        └──────────┘  └───────────┘  └───────────┘
```

### Data Flow

1. **RFP Creation**: User enters natural language → Backend sends to OpenAI → AI returns structured JSON (items, budget, terms) → Saved to PostgreSQL
2. **Vendor Management**: CRUD operations on vendor master data
3. **Email Dispatch**: Select vendors → System generates formatted RFP email → Sends via SMTP → Tracks delivery status per vendor
4. **Proposal Ingestion**: IMAP fetches unread emails → Matches sender to vendor → Matches subject to RFP → Creates proposal record with raw text. Also supports manual entry and PDF upload with text extraction.
5. **AI Parsing**: Raw proposal text sent to OpenAI → Extracts line items, pricing, terms, compliance → Stores structured `parsedData` JSON
6. **Comparison**: All parsed proposals for an RFP sent to OpenAI → Scores each vendor on 6 criteria → Produces weighted recommendation with reasoning

### Key Design Decisions

- **JSONB for structured data**: RFP requirements and parsed proposals are stored as JSONB columns. This avoids rigid schema for highly variable vendor responses while still allowing PostgreSQL queries.
- **Stateful proposal pipeline**: Proposals move through `received → parsing → parsed → error` states, enabling retry on failure and clear visibility into pipeline status.
- **AI with structured output**: All LLM calls use `response_format: json_object` with explicit schema in the system prompt, reducing hallucination and ensuring parseable output.
- **Email matching heuristic**: Inbound emails match to vendors by sender address, then to RFPs by subject line pattern (`RFP-XXXX`) with fallback to most recent sent RFP.

## Database Schema

```
rfps
├── id (PK)
├── title
├── raw_input (TEXT) — original natural language
├── structured_data (JSONB) — AI-parsed: items, budget, timeline, terms
├── budget (DECIMAL)
├── currency
├── delivery_days
├── deadline
├── status (draft|published|sent|evaluating|awarded|closed)
└── timestamps

vendors
├── id (PK)
├── name, email, company, phone, category, address, notes
└── timestamps

rfp_vendors (join table)
├── rfp_id (FK), vendor_id (FK)
├── email_status (pending|sent|failed|delivered)
├── sent_at, email_error
└── timestamps

proposals
├── id (PK)
├── rfp_id (FK), vendor_id (FK)
├── raw_content (TEXT)
├── source_type (email|pdf|manual)
├── attachments (JSONB)
├── parsed_data (JSONB) — AI-extracted pricing, terms, line items
├── total_price (DECIMAL)
├── score (0–100)
├── status (received|parsing|parsed|error)
└── timestamps

comparisons
├── id (PK)
├── rfp_id (FK)
├── comparison_data (JSONB) — per-vendor score breakdown
├── recommendation (JSONB) — {vendorId, reasoning, confidence}
├── summary (TEXT)
└── timestamps
```

## API Endpoints

### RFPs
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/rfps` | Create RFP from natural language (`{rawInput}`) |
| GET | `/api/rfps` | List all RFPs with vendors and proposal counts |
| GET | `/api/rfps/:id` | Get RFP with vendors, proposals, and latest comparison |
| PUT | `/api/rfps/:id` | Update RFP fields |
| DELETE | `/api/rfps/:id` | Delete RFP |
| POST | `/api/rfps/:id/send` | Send RFP to vendors (`{vendorIds: [1,2]}`) |
| POST | `/api/rfps/:id/compare` | AI-compare all parsed proposals for this RFP |

### Vendors
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/vendors` | Create vendor (`{name, email, ...}`) |
| GET | `/api/vendors` | List vendors (supports `?search=` and `?category=`) |
| GET | `/api/vendors/:id` | Get vendor |
| PUT | `/api/vendors/:id` | Update vendor |
| DELETE | `/api/vendors/:id` | Delete vendor |

### Proposals
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/proposals/manual` | Add proposal manually (`{rfpId, vendorId, rawContent}`) |
| POST | `/api/proposals/upload` | Upload PDF proposal (multipart form: `file`, `rfpId`, `vendorId`) |
| POST | `/api/proposals/fetch-emails` | Fetch and process unread vendor emails via IMAP |
| GET | `/api/proposals` | List proposals (supports `?rfpId=`) |
| GET | `/api/proposals/:id` | Get single proposal |
| POST | `/api/proposals/:id/parse` | AI-parse a received proposal into structured data |

## AI Integration

### Three AI Functions

1. **`parseRfpFromNaturalLanguage`** — Converts free-form text like "Need 20 laptops..." into structured JSON with items, quantities, specs, budget, timeline, and terms.

2. **`parseVendorProposal`** — Takes raw proposal text (email body + PDF extracted text) plus the RFP context, extracts line items with pricing, delivery terms, warranty, and compliance assessment.

3. **`compareProposals`** — Takes all parsed proposals for an RFP, scores each on 6 weighted criteria (price, compliance, delivery, payment, warranty, overall value), and produces a recommendation with confidence level and reasoning.

### Prompt Design Choices

- **JSON mode enforced**: All calls use `response_format: { type: 'json_object' }` to guarantee parseable output
- **Low temperature** (0.1–0.2): Prioritizes consistency over creativity for data extraction
- **Explicit schema in system prompt**: Each function specifies the exact JSON shape expected, reducing structural hallucination
- **RFP context passed to parsing**: Vendor proposals are parsed with knowledge of what was requested, enabling compliance assessment
- **Model**: GPT-4o-mini for cost efficiency — adequate for structured extraction tasks

## Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- OpenAI API key
- SMTP/IMAP email account (Gmail with App Password works)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd rfp-management-system

# Backend setup
cd backend
cp ../.env.example .env    # Edit .env with your credentials
npm install
npm run db:sync            # Creates/migrates database tables
npm run dev                # Starts backend on port 5000

# Frontend setup (in a separate terminal)
cd frontend
npm install
npm start                  # Starts frontend on port 3000
```

### Environment Variables

Copy `.env.example` and fill in:
- `DB_*` — PostgreSQL connection details
- `OPENAI_API_KEY` — Your OpenAI API key
- `SMTP_*` — Outgoing email (e.g., Gmail SMTP with App Password)
- `IMAP_*` — Incoming email (e.g., Gmail IMAP)

### Gmail Setup (for email integration)
1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password (Google Account → Security → App Passwords)
3. Use the App Password for both `SMTP_PASSWORD` and `IMAP_PASSWORD`

## Assumptions & Tradeoffs

1. **Single-user system** — No authentication, no multi-tenancy. All data belongs to one user.
2. **Email matching is heuristic** — Vendor emails match by sender address; RFP matching uses subject line pattern then falls back to most recent. In production, a unique reply-to address per RFP would be more robust.
3. **AI parsing is best-effort** — Vendor responses are inherently messy. The AI may misparse unusual formats. The system preserves raw content for human review alongside parsed data.
4. **No background job queue** — Email sending and AI calls happen synchronously in request handlers. For production, these should move to a job queue (Bull/Redis) to avoid request timeouts.
5. **PDF text extraction only** — Uses `pdf-parse` for text-based PDFs. Scanned image PDFs would need OCR (Tesseract) which is not implemented.
6. **Scoring weights are fixed** — The comparison criteria weights are defined in the AI prompt. A production system would let users configure weights.
7. **GPT-4o-mini for cost** — Adequate for extraction tasks. Complex proposals might benefit from GPT-4o at higher cost.
8. **No email tracking** — We track send status but not delivery/read receipts.

## Future Improvements

- **Job queue** (Bull + Redis): Move AI calls and email operations to background workers
- **OCR for scanned PDFs**: Integrate Tesseract for image-based PDF extraction
- **Configurable scoring weights**: Let user adjust criteria importance per RFP
- **Email threading**: Use Message-ID/In-Reply-To headers for more reliable email matching
- **Approval workflow**: Multi-step approval before awarding vendor
- **Audit trail**: Log all AI decisions with full prompt/response for transparency
- **Caching**: Cache AI responses to avoid re-parsing identical content
- **WebSocket notifications**: Real-time updates when new proposals arrive
