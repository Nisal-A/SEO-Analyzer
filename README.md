# SEOCheck

A full-stack MERN (MongoDB, Express 5, React + Vite, Node.js 22+) web application that safely fetches a single public web page, runs 18 deterministic on-page and technical SEO checks, calculates a transparent **educational audit score** out of 100, generates data-driven recommendations, and persists audit history in MongoDB Atlas.

> **Educational Disclaimer:** SEOCheck provides an **educational audit score** based on documented on-page and technical rules. It is **not** an official Google score and does not predict search engine rankings.

---

## System Architecture

```
┌────────────────────────┐        HTTPS / JSON         ┌───────────────────────────────┐
│  React client (Vite)   │  ─────────────────────────▶ │  Express 5 API (Node.js 22+)  │
│  pages, components,    │  ◀─────────────────────────  │                               │
│  Axios + X-Client-Id   │                              │  routes → controllers →       │
└────────────────────────┘                              │  services → models            │
                                                        └──────┬───────────────┬────────┘
                                                               │               │
                                              safeFetch (SSRF-protected)       │ Mongoose
                                                               │               ▼
                                                               ▼        ┌─────────────┐
                                                     ┌────────────────┐ │ MongoDB     │
                                                     │ Target website │ │ Atlas       │
                                                     │ page/robots/   │ │ `audits`    │
                                                     │ sitemap        │ └─────────────┘
                                                     └────────────────┘
```

---

## Key Features

- **SSRF-Protected Fetching Engine (`safeFetch`)**
  - Strict WHATWG `URL` validation (`http:`/`https:` only, ports `80`/`443` only, rejects embedded `user:pass@` credentials and `localhost` / `*.localhost` / `*.local` / `*.internal`).
  - Node 22 built-in `net.BlockList` IP classifier blocking loopback (`127.0.0.0/8`), private RFC 1918 (`10/8`, `172.16/12`, `192.168/16`), CGNAT (`100.64/10`), link-local & cloud metadata (`169.254.0.0/16`), multicast/reserved IPv4, IPv6 (`::`, `::1`, `fc00::/7`, `fe80::/10`, `ff00::/8`), and unwrapped IPv4-mapped IPv6 addresses (both dotted and hex forms).
  - Multi-record DNS validation + custom pinned `lookup` callback on HTTP/HTTPS agents to eliminate DNS rebinding.
  - Manual redirect validation on every hop (`maxRedirects: 0` in Axios, max 5 hops), proxy env bypass protection (`proxy: false`), 10-second `AbortController` deadline, 2 MB streaming decompressed size cap, and HTML `Content-Type` enforcement.
- **18 Rule-Based SEO Checks & Technical Probes**
  - Cheerio parser extracts bounded metadata, headings (`H1`–`H6`), images (separating missing `alt` from decorative `alt=""`), links (internal/external/invalid), and technical headers (`https`, canonical, viewport, `html lang`, meta robots).
  - Graceful `/robots.txt` and XML sitemap probes routed through `safeFetch` (so malicious `Sitemap:` directives pointing to private IPs are blocked and recorded safely as `not_tested`).
- **Transparent 100-Point Scoring & Recommendations**
  - Single-source-of-truth weights (`server/services/scoring/scoringConfig.js`).
  - Untestable checks (`not_tested`, such as zero images or unreachable probes) are excluded from both earned and possible points and surfaced via `scoreCoverage` and a dedicated **Could Not Verify** list.
  - Dynamic recommendations interpolate real measured findings (character counts, skipped levels, missing ALT counts) and sort `High -> Medium -> Low`.
- **Interactive Dashboard, History & Export**
  - Radial score gauge, status summary cards, responsive Recharts category bar chart, filterable check list, and structured detail panels.
  - Searchable, paginated audit history with confirmation-protected delete and anonymous per-browser scoping via `X-Client-Id` (`localStorage`).
  - Client-side RFC 4180 CSV export with spreadsheet formula-injection neutralization and print-optimized PDF layout (`@media print`).

---

## Tech Stack

- **Runtime:** Node.js 22+ LTS (plain JavaScript ES modules — uses built-in `--env-file`, `--watch`, `net.BlockList`, `node:test`)
- **Backend (`server/`):** Express 5.3, Mongoose 9.12, Axios 1.21, Cheerio 1.2, Helmet 8.3, CORS 2.8, express-rate-limit 8.7, Supertest 7.3
- **Frontend (`client/`):** React 19.3, Vite 8.3, Tailwind CSS 4.3 (`@tailwindcss/vite`), React Router 7.18, Axios 1.21, Recharts 3.11, Lucide React 1.77
- **Workspace Runner:** `concurrently` 10.0

---

## Folder Structure

```text
SEO-Analyzer/
├── package.json
├── .gitignore
├── .editorconfig
├── README.md
├── PROJECT_MASTER_PLAN.md
├── DEVELOPMENT_PROGRESS.md
├── TECHNICAL_DECISIONS.md
├── docs/
│   ├── SEOCheck.postman_collection.json
│   └── screenshots/
├── client/
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── vercel.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       ├── layouts/
│       │   └── AppLayout.jsx
│       ├── pages/
│       │   ├── OverviewPage.jsx
│       │   ├── AnalyzePage.jsx
│       │   ├── AuditResultPage.jsx
│       │   ├── AuditHistoryPage.jsx
│       │   ├── AboutPage.jsx
│       │   └── NotFoundPage.jsx
│       ├── components/
│       │   ├── ui/        # Alert, Badge, Button, Card, EmptyState, Input, Spinner
│       │   ├── audit/     # UrlForm, ScoreGauge, StatusSummary, CategoryChart,
│       │   │              # ChecksList, HeadingTree, ImageReport, LinkReport,
│       │   │              # TechnicalReport, RecommendationList
│       │   └── history/   # SearchBar, HistoryTable, Pagination
│       ├── services/      # apiClient.js, auditService.js
│       ├── hooks/         # useAnalyzeAudit.js, useAuditHistory.js, useAuditDetail.js
│       └── utils/         # constants.js, formatters.js, csvExport.js
└── server/
    ├── .env.example
    ├── package.json
    ├── server.js
    ├── app.js
    ├── config/            # env.js, db.js
    ├── routes/            # index.js, healthRoutes.js, auditRoutes.js
    ├── controllers/       # healthController.js, auditController.js
    ├── middleware/        # rateLimiters.js, clientIdentity.js,
    │                      # validateAnalyzeRequest.js, validateObjectId.js,
    │                      # notFound.js, errorHandler.js
    ├── models/            # Audit.js
    ├── services/
    │   ├── fetch/         # safeFetch.js, safeLookup.js
    │   ├── seo/           # parsePage.js, analyzePage.js, checks/*.js
    │   ├── scoring/       # scoringConfig.js, scoreService.js
    │   ├── recommendationService.js
    │   └── auditService.js
    ├── utils/             # urlValidator.js, ipClassifier.js, AppError.js,
    │                      # errorCodes.js, logger.js
    └── tests/             # unit/, integration/, fixtures/
```

---

## Scoring Methodology (100 Points)

| Category | Weight | Checks |
|---|---:|---|
| Title | 15 | `title.exists` (8), `title.length` (7) |
| Meta Description | 15 | `meta.exists` (8), `meta.length` (7) |
| Headings | 15 | `headings.h1Exists` (8), `headings.h1Single` (4), `headings.hierarchy` (3) |
| Images | 15 | `images.altCoverage` (15) |
| Links | 10 | `links.internalPresent` (4), `links.validHref` (6) |
| Technical | 30 | `tech.https` (6), `tech.statusRedirects` (5), `tech.canonical` (4), `tech.viewport` (4), `tech.metaRobots` (4), `tech.lang` (3), `tech.robotsTxt` (2), `tech.sitemap` (2) |

- **Status credit:** `passed = 100%`, `warning = 50%`, `failed = 0%`.
- **Coverage fairness:** `not_tested` checks are excluded from both earned and possible points; reports always display `scoreCoverage` (`% of 100 points tested`) and show a prominent notice when coverage drops below 50%.
- **Score bands:** `90–100 Excellent` · `75–89 Good` · `50–74 Needs work` · `0–49 Poor`.

---

## REST API Endpoints

Base path: `/api`. Import [docs/SEOCheck.postman_collection.json](./docs/SEOCheck.postman_collection.json) into Postman to test every endpoint.

| Method | Endpoint | Purpose | Success | Common Errors |
|---|---|---|---|---|
| `GET` | `/api/health` | API and MongoDB connection status | `200` | — |
| `POST` | `/api/audits/analyze` | Fetch, analyze, score, and save URL | `201` | `400` (`INVALID_URL`, `BLOCKED_URL`, `VALIDATION_ERROR`), `422` (`NOT_HTML`, `RESPONSE_TOO_LARGE`, `TOO_MANY_REDIRECTS`, `TARGET_HTTP_ERROR`), `429` (`RATE_LIMITED`), `502` (`DNS_FAILED`, `TARGET_UNREACHABLE`), `504` (`TARGET_TIMEOUT`) |
| `GET` | `/api/audits` | Paginated history (`page`, `limit <= 50`, `search`) | `200` | `400` (`VALIDATION_ERROR`) |
| `GET` | `/api/audits/:id` | Retrieve one saved audit report | `200` | `400` (`VALIDATION_ERROR`), `404` (`NOT_FOUND`) |
| `DELETE` | `/api/audits/:id` | Delete one saved audit report | `204` | `400` (`VALIDATION_ERROR`), `404` (`NOT_FOUND`) |

Standard response envelopes:
- Success: `{ "success": true, "data": { ... }, "meta"?: { "page", "limit", "total", "totalPages" } }`
- Error: `{ "success": false, "error": { "code": "BLOCKED_URL", "message": "This address cannot be analyzed." } }`

---

## Local Setup

### Prerequisites

- Node.js **22 LTS or newer**
- npm
- A MongoDB Atlas cluster (free tier) or local MongoDB instance

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example files (never commit `.env`):

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Set `MONGODB_URI` in `server/.env` to your MongoDB Atlas connection string.

### 3. Run Development Servers

```bash
npm run dev
```

- Client UI: `http://localhost:5173`
- Express API: `http://localhost:5000/api/health`

---

## Running Tests & Production Build

```bash
# Run all server unit, HTML fixture, SSRF, and API integration tests (offline)
npm test

# Build the React client for production
npm run build
```

---

## Deployment Guide

### 1. Database (MongoDB Atlas)
1. Create a free M0 cluster and database user with read/write access to your database.
2. Add your hosting provider's outbound IPs (or `0.0.0.0/0` if using dynamic cloud egress with strong credentials) in Network Access.

### 2. Backend API (Render or Railway)
1. Connect the GitHub repository and set **Root Directory** to `server`.
2. **Build Command:** `npm install`
3. **Start Command:** `npm start` (runs `node server.js`; reads injected host environment variables directly without `--env-file`).
4. Set environment variables:
   - `NODE_ENV=production` (enables `app.set('trust proxy', 1)` for accurate rate-limiting behind reverse proxies)
   - `PORT=5000` (or let the platform inject `PORT`)
   - `MONGODB_URI=<your Atlas URI>`
   - `CLIENT_ORIGIN=https://<your-vercel-app>.vercel.app`
   - Optional overrides: `FETCH_TIMEOUT_MS`, `FETCH_MAX_BYTES`, `FETCH_MAX_REDIRECTS`, `RATE_LIMIT_ANALYZE_PER_15MIN`, `RATE_LIMIT_GLOBAL_PER_15MIN`

### 3. Frontend Client (Vercel)
1. Import the GitHub repository and set **Root Directory** to `client`.
2. Framework Preset: **Vite** (`npm run build`, output `dist`). SPA routing rewrites are preconfigured in [client/vercel.json](./client/vercel.json).
3. Set environment variable:
   - `VITE_API_BASE_URL=https://<your-api-host>/api`

---

## Screenshots

*(Drop captured UI screenshots into `docs/screenshots/` and link them below once live demo QA is complete.)*

- `docs/screenshots/overview.png` – Overview Dashboard & Quick URL Analysis
- `docs/screenshots/report.png` – Interactive Audit Report, Radial Score Gauge & Category Chart
- `docs/screenshots/history.png` – Searchable Audit History & Delete Confirmation
