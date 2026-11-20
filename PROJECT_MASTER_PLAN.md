# SEOCheck – Project Master Plan

> Status: **DRAFT v0.1 – awaiting owner approval.** No application code exists yet.
> Companion files: `DEVELOPMENT_PROGRESS.md` (what is done) · `TECHNICAL_DECISIONS.md` (why we chose things)

---

## 1. Project Summary

SEOCheck is a full-stack MERN application. A user submits a public URL. The backend safely fetches that single page, parses the HTML, runs rule-based SEO checks, calculates a transparent score out of 100, generates recommendations from the real findings, and saves the audit in MongoDB. The React frontend shows the results, keeps a history, and exports reports.

**Not an official Google score.** The UI, README and reports must always label it an "educational audit score".

**Scope of one audit (v1):** the one submitted page, plus `robots.txt` and the sitemap at that site's origin. SEOCheck does not crawl the whole site.

**Portfolio goals:** real working software, secure by design (SSRF protection is the standout feature), clean architecture, tests, documentation, deployable demo.

---

## 2. System Architecture

```
┌────────────────────────┐        HTTPS / JSON         ┌───────────────────────────────┐
│  React client (Vite)   │  ─────────────────────────▶ │  Express API (Node.js)        │
│  pages, components,    │  ◀─────────────────────────  │                               │
│  Axios service layer   │                              │  routes → controllers →       │
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

### 2.1 Backend layers (each has one job)

| Layer | Responsibility | Must NOT do |
|---|---|---|
| `routes/` | Map URL + HTTP method to a controller; attach middleware | Contain logic |
| `middleware/` | Rate limiting, request validation, error handling, 404 | Talk to the database |
| `controllers/` | Read the request, call a service, send the response | Parse HTML, score, or query the DB directly |
| `services/` | Business logic: fetching, SEO checks, scoring, recommendations, audit persistence | Know about `req`/`res` |
| `models/` | Mongoose schemas | Business logic |
| `utils/` | Small pure helpers (URL normalising, IP checks, errors) | Side effects |
| `config/` | Environment loading and validation, DB connection | Business logic |

### 2.2 Analysis pipeline (inside `POST /api/audits/analyze`)

1. **Validate input** – body has a string `url`, length-capped, trimmed.
2. **Normalise and validate URL** – http/https only, no credentials in the URL, ports 80/443 only, no localhost-style hostnames.
3. **Safe fetch the page** – DNS-resolve, reject unsafe IPs, connect to the *validated* IP, follow redirects manually (re-validate every hop), enforce timeout and size limit, require an HTML content type.
4. **Parse with Cheerio** – extract title, meta tags, headings, images, links, canonical, viewport, lang, robots meta.
5. **Technical probes** – safe fetch `/robots.txt` and sitemap (from `robots.txt` `Sitemap:` lines, falling back to `/sitemap.xml`). A failure here becomes "not tested", never a crash.
6. **Run checks** – each check returns `{ id, category, status, maxPoints, earnedPoints, value, message }`.
7. **Score** – category and overall scores from check results (Section 8).
8. **Recommend** – one recommendation per non-passing check, built from the actual finding.
9. **Save** – store the derived report (not the raw HTML).
10. **Respond** – `201` with the saved audit.

### 2.3 Frontend structure

- **Pages** are thin and compose components.
- **Components** are reusable and presentational.
- **`services/`** holds all Axios calls. Components never call Axios directly.
- **`hooks/`** (e.g. `useAnalyzeAudit`, `useAuditHistory`) hold loading/error/data state.
- **No hardcoded results.** Every number on screen comes from the API.

---

## 3. Folder Structure (target)

```
SEOCheck/
├── package.json              # root workspace + convenience scripts
├── .gitignore
├── .editorconfig
├── README.md
├── PROJECT_MASTER_PLAN.md
├── DEVELOPMENT_PROGRESS.md
├── TECHNICAL_DECISIONS.md
├── docs/                     # screenshots, Postman collection export
│
├── client/
│   ├── .env.example
│   ├── index.html
│   ├── vite.config.js
│   ├── public/
│   └── src/
│       ├── main.jsx
│       ├── App.jsx           # routes
│       ├── assets/
│       ├── layouts/          # AppLayout (navbar + footer)
│       ├── pages/            # OverviewPage, AnalyzePage, AuditResultPage,
│       │                     # AuditHistoryPage, AboutPage, NotFoundPage
│       ├── components/
│       │   ├── ui/           # Button, Card, Badge, Input, Spinner, Alert, EmptyState
│       │   ├── audit/        # UrlForm, ScoreGauge, StatusSummary, CategoryChart,
│       │   │                 # ChecksList, HeadingTree, ImageReport, LinkReport,
│       │   │                 # TechnicalReport, RecommendationList
│       │   └── history/      # HistoryTable, SearchBar, Pagination
│       ├── services/         # apiClient.js, auditService.js
│       ├── hooks/
│       └── utils/            # formatters, csvExport, constants
│
└── server/
    ├── .env.example
    ├── package.json
    ├── server.js             # starts DB + HTTP listener
    ├── app.js                # builds the Express app (importable for tests)
    ├── config/               # env.js (validation), db.js
    ├── routes/               # index.js, auditRoutes.js, healthRoutes.js
    ├── controllers/          # auditController.js, healthController.js
    ├── middleware/           # rateLimiters.js, validateAnalyzeRequest.js,
    │                         # validateObjectId.js, notFound.js, errorHandler.js
    ├── models/               # Audit.js
    ├── services/
    │   ├── fetch/            # safeFetch.js, safeLookup.js
    │   ├── seo/              # parsePage.js, checks/*.js, analyzePage.js
    │   ├── scoring/          # scoringConfig.js, scoreService.js
    │   ├── recommendationService.js
    │   └── auditService.js
    ├── utils/                # urlValidator.js, ipClassifier.js, AppError.js, errorCodes.js
    └── tests/                # unit/, integration/, fixtures/
```

---

## 4. Database Design

**Database:** MongoDB Atlas · **Collection:** `audits` · **ODM:** Mongoose

Principle: store enough to **re-display the full report without refetching the site**, but not the page HTML.

```
Audit {
  _id                ObjectId
  schemaVersion      Number            // starts at 1
  url                String            // what the user submitted (normalised)
  finalUrl           String            // after redirects
  redirectChain      [{ url, status }] // capped at 10
  responseStatus     Number            // final HTTP status
  status             String            // 'completed' (failed fetches are not stored in v1)
  analyzedAt         Date

  pageTitle          String | null
  metaDescription    String | null

  overallScore       Number            // 0–100
  scoreCoverage      Number            // % of the 100 points that were actually testable
  categoryScores     [{ category, label, weight, earned, possible, score }]
  summary            { passed, warning, failed, notTested }

  seoChecks          [{ id, category, label, status, maxPoints, earnedPoints,
                        value (Mixed), message, reason }]
  recommendations    [{ checkId, priority, title, description }]

  details: {
    titleLength, descriptionLength,
    headings:  { h1:[String], h2:[String], h3:[String], counts },
    images:    { total, withAlt, missingAlt, emptyAlt, altCoverage, missingAltSamples:[src] },
    links:     { internal, external, invalid, invalidSamples:[href] },
    technical: { https, canonical, robotsMeta, viewport, lang,
                 robotsTxt:{ status, url }, sitemap:{ status, url } }
  }

  createdAt, updatedAt  (Mongoose timestamps)
}
```

- **Check status enum:** `passed | warning | failed | not_tested`.
- **Caps** on every array (e.g. 50 headings, 20 sample URLs, 200 chars per string) keep documents small and prevent abuse.
- **Indexes:** `{ analyzedAt: -1 }` for history; `{ url: 1 }` for search. Search input must be regex-escaped.
- **Pending decision (Q1):** if history becomes per-browser or per-user, add an `ownerId` field and index `{ ownerId: 1, analyzedAt: -1 }`.

---

## 5. REST API

Base path: `/api`. All responses are JSON.

| Method | Endpoint | Purpose | Success | Common errors |
|---|---|---|---|---|
| GET | `/api/health` | Backend + DB status | `200` | – |
| POST | `/api/audits/analyze` | Analyze a URL, save, return report | `201` | `400` invalid/blocked URL · `422` target not analyzable · `429` rate limit · `502` target unreachable · `504` target timeout |
| GET | `/api/audits` | History. Query: `page`, `limit` (max 50), `search` | `200` | `400` bad query |
| GET | `/api/audits/:id` | One full report | `200` | `400` bad id · `404` |
| DELETE | `/api/audits/:id` | Delete one report | `204` | `400` · `404` |

**Success shape**

```json
{ "success": true, "data": { } }
```

History adds `"meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 }`.

**Error shape (never leaks stack traces, DB details or internal IPs)**

```json
{ "success": false, "error": { "code": "BLOCKED_URL", "message": "This address cannot be analyzed." } }
```

**Error codes:** `INVALID_URL`, `BLOCKED_URL`, `DNS_FAILED`, `TARGET_UNREACHABLE`, `TARGET_TIMEOUT`, `TARGET_HTTP_ERROR`, `NOT_HTML`, `RESPONSE_TOO_LARGE`, `TOO_MANY_REDIRECTS`, `VALIDATION_ERROR`, `NOT_FOUND`, `RATE_LIMITED`, `INTERNAL_ERROR`.

CSV export and print layout are generated **client-side** from the saved audit, so no export endpoint is needed in v1 (ADR-012).

---

## 6. Application Workflows

**A. Analyze a website**
User enters URL → client checks it is non-empty → `POST /analyze` → loading state → server pipeline (2.2) → client navigates to `/audits/:id` showing the saved report. On error the form stays visible with a friendly message by error code.

**B. View history**
`/history` → `GET /api/audits?page&search` → table (URL, score, date, status counts) → open a report, or delete with a confirmation step.

**C. Overview dashboard**
Hero + URL form → "Recent audits" from `GET /api/audits?limit=5` → empty state if none. Score/status cards appear only when a real audit exists.

**D. Export**
On a report page: "Download CSV" (built from the audit already loaded) and "Print / Save as PDF" (print-optimised CSS + `window.print()`).

**Routes**

| Path | Page |
|---|---|
| `/` | Overview |
| `/analyze` | Analyze Website |
| `/audits/:id` | Individual Audit Report (also the results view after an analysis) |
| `/history` | Audit History |
| `/about` | About SEOCheck |
| `*` | Not found |

---

## 7. Check Catalogue (what is tested)

Statuses: **passed**, **warning**, **failed**, **not_tested** (could not verify, or does not apply; always carries a `reason`).

| Category | Check ID | Rule |
|---|---|---|
| Title | `title.exists` | Non-empty `<title>` |
| Title | `title.length` | 30–60 chars = pass · 10–29 or 61–70 = warning · else fail |
| Meta description | `meta.exists` | Non-empty `<meta name="description">` |
| Meta description | `meta.length` | 70–160 chars = pass · 50–69 or 161–200 = warning · else fail |
| Headings | `headings.h1Exists` | At least one non-empty H1 |
| Headings | `headings.h1Single` | Exactly one H1 (more than one = warning) |
| Headings | `headings.hierarchy` | No skipped levels, e.g. H1 → H3 (skip = warning) |
| Images | `images.altCoverage` | ≥90% of `<img>` have non-empty ALT = pass · 50–89% = warning · <50% fail. No images = `not_tested` (reason: none found). Decorative `alt=""` is counted as "empty ALT" and reported separately, not silently treated as an error |
| Links | `links.internalPresent` | At least one internal link |
| Links | `links.validHref` | No empty, `#`-only or `javascript:` hrefs (some = warning, many = fail) |
| Technical | `tech.https` | Final URL uses HTTPS |
| Technical | `tech.statusRedirects` | Final status 200, ≤2 redirects = pass · >2 redirects = warning |
| Technical | `tech.canonical` | `<link rel="canonical">` present with a valid absolute URL |
| Technical | `tech.viewport` | `<meta name="viewport">` present |
| Technical | `tech.lang` | `<html lang>` present and non-empty |
| Technical | `tech.metaRobots` | No `noindex` (present but not blocking = pass; `noindex` = fail) |
| Technical | `tech.robotsTxt` | `/robots.txt` returns 200 (404 = warning; network/blocked failure = not_tested) |
| Technical | `tech.sitemap` | Sitemap URL returns 200 and looks like XML (missing = warning; unreachable = not_tested) |

Internal/external link counts, heading lists and image counts are shown as **informational data**, not scored.

---

## 8. Scoring Model (transparent, rule-based)

**Total = 100 points.**

| Category | Weight | Checks and points |
|---|---|---|
| Title | 15 | exists 8 · length 7 |
| Meta description | 15 | exists 8 · length 7 |
| Headings | 15 | H1 exists 8 · single H1 4 · hierarchy 3 |
| Images | 15 | ALT coverage 15 |
| Links | 10 | internal present 4 · valid hrefs 6 |
| Technical | 30 | HTTPS 6 · status/redirects 5 · canonical 4 · viewport 4 · meta robots 4 · lang 3 · robots.txt 2 · sitemap 2 |

**Points per status:** passed = 100% of the check's points · warning = 50% · failed = 0%.
Checks may define their own partial credit (e.g. ALT coverage = proportional), but it must be documented in `scoringConfig.js`.

**Not tested checks are excluded from both earned and possible points**, so unverifiable checks neither help nor hurt:

```
categoryScore = earned / possible × 100          (possible = sum of tested checks' points)
overallScore  = round( Σ earned / Σ possible × 100 )   (over all tested checks)
scoreCoverage = Σ possible / 100 × 100%
```

Reports always show `scoreCoverage` (e.g. "Score based on 92% of checks") so a score is never presented as more complete than it is. If coverage falls below 50% the UI shows a prominent notice.

Score bands (display only): 90–100 Excellent · 75–89 Good · 50–74 Needs work · 0–49 Poor.

---

## 9. Recommendations

One recommendation per `warning`/`failed` check, produced by a template that inserts the **real measured value**, for example: *"Your title is 72 characters. Search results usually show about 60, so shorten it by roughly 12 characters."* Priority: `high` (failed, weight ≥ 8) · `medium` (other failed) · `low` (warning). Passed and not-tested checks get no recommendation; not-tested checks appear in a separate "Could not verify" list with their reason.

---

## 10. Security Requirements

| Threat | Mitigation |
|---|---|
| SSRF to internal services / cloud metadata | Block loopback, private, link-local (incl. `169.254.169.254`), CGNAT, multicast, reserved ranges and IPv4-mapped IPv6; check **every** IP the hostname resolves to |
| DNS rebinding | Resolve once in a custom `lookup`, validate, and connect to that exact IP |
| Redirect to internal address | `maxRedirects: 0`; follow manually; re-validate each hop; max 5 hops |
| Odd URLs | http/https only; reject `user:pass@`; ports 80/443 only; reject numeric/obfuscated hosts that resolve to blocked IPs |
| Slow or huge responses | Overall deadline (10 s) via `AbortController`; 2 MB cap counted on decompressed bytes; HTML content-type required |
| Abuse | `express-rate-limit`: strict limiter on `/analyze`, looser global limiter; JSON body limit 10 kB |
| Info leakage | Safe messages only; no stack traces; DB/URL internals never returned |
| Injection via search | Escape user input before building a regex; validate ObjectIds |
| XSS | React escapes by default; **never** use `dangerouslySetInnerHTML` for scraped content; scraped text is truncated |
| Secrets | `.env` git-ignored; `.env.example` committed; secrets never in client code (`VITE_*` variables are public) |
| HTTP hardening | `helmet`; CORS limited to the configured client origin |
| Ethics | Identifiable `User-Agent` (`SEOCheckBot/1.0`); no CAPTCHA/auth/anti-bot bypass; single page per audit |

---

## 11. Dependencies and Tools

*Install the latest stable versions at install time and record the exact versions in `DEVELOPMENT_PROGRESS.md`.*

**Runtime/tools:** Node.js 22 LTS or newer · npm · Git · GitHub · Postman · MongoDB Atlas (free tier) · Antigravity IDE

**Server**

| Package | Why |
|---|---|
| `express` | Web framework (v5: async errors reach the error handler automatically) |
| `mongoose` | MongoDB schemas and queries |
| `axios` | Fetch target pages (required by the project stack) |
| `cheerio` | Parse HTML (required by the project stack) |
| `helmet` | Security headers |
| `cors` | Allow only our client origin |
| `express-rate-limit` | Rate limiting |
| *dev:* `supertest` | HTTP-level API tests |

**Built into Node 22, so no package is needed:** `--env-file` (load `.env`), `--watch` (auto-restart), `net.BlockList` (IP range checks), `dns`, `node:test` (test runner).

**Client**

| Package | Why |
|---|---|
| `react`, `react-dom`, `vite`, `@vitejs/plugin-react` | UI and build tool |
| `tailwindcss` (+ its Vite plugin) | Styling |
| `react-router-dom` | Routing |
| `axios` | API calls |
| `recharts` | Charts |
| `lucide-react` | Icons |

**Optional, needs your approval:** `concurrently` (run client + server with one command) · Vitest + React Testing Library (frontend tests).

**Environment variables**

`server/.env.example`
```
NODE_ENV=development
PORT=5000
MONGODB_URI=<your Atlas connection string>
CLIENT_ORIGIN=http://localhost:5173
FETCH_TIMEOUT_MS=10000
FETCH_MAX_BYTES=2097152
FETCH_MAX_REDIRECTS=5
RATE_LIMIT_ANALYZE_PER_15MIN=10
RATE_LIMIT_GLOBAL_PER_15MIN=200
```

`client/.env.example`
```
VITE_API_BASE_URL=http://localhost:5000/api
```

Atlas setup: free cluster → database user → network access (your IP for development) → copy connection string into `server/.env` only.

---

## 12. Development Roadmap

Rule: **one task = one Antigravity prompt = one review = one commit.** Do not start the next task until the current one passes review and docs are updated.

### Milestones

| # | Milestone | Done when |
|---|---|---|
| M1 | Foundation | Client and server run; `/api/health` reachable from the client |
| M2 | Secure audit engine | Postman: posting a URL returns a scored report; SSRF tests pass |
| M3 | Persistent API | Audits saved/listed/searched/deleted in Atlas |
| M4 | UI MVP | Analyze → results → history works end to end in the browser |
| M5 | Export + polish | CSV, print/PDF, responsive, accessible |
| M6 | Release | Tests, README with screenshots, deployed demo, LinkedIn write-up |

### Phase 0 – Foundation (→ M1)
- **P0-T1** Verify tools; create GitHub repo; create Atlas cluster, DB user, network rule
- **P0-T2** Repo skeleton: root `package.json` (workspaces), `.gitignore`, `.editorconfig`, README stub, `.env.example` files
- **P0-T3** Server scaffold: `app.js`/`server.js`, env validation, `/api/health`
- **P0-T4** Client scaffold: Vite + React + Tailwind + Router + Axios client; confirm it reads `/api/health`

### Phase 1 – Backend foundation
- **P1-T1** Middleware stack: helmet, CORS, JSON limit, global rate limiter
- **P1-T2** `AppError`, error codes, `notFound` and central `errorHandler`
- **P1-T3** MongoDB connection and startup/shutdown handling; health reports DB state

### Phase 2 – Secure fetching (SSRF)
- **P2-T1** URL validator/normaliser + unit tests
- **P2-T2** IP classifier (`net.BlockList`) + unit tests incl. IPv6 and IPv4-mapped
- **P2-T3** Safe DNS lookup (validate all addresses, pin IP)
- **P2-T4** `safeFetch`: manual redirects, deadline, size cap, content-type check
- **P2-T5** SSRF test suite (localhost, private IPs, metadata IP, redirect-to-private, oversize, slow, non-HTML) using a local test server

### Phase 3 – SEO engine
- **P3-T1** `parsePage` + title and meta description checks
- **P3-T2** Heading extraction and checks
- **P3-T3** Image checks
- **P3-T4** Link checks
- **P3-T5** Technical on-page checks (HTTPS, canonical, viewport, lang, meta robots, status/redirects)
- **P3-T6** `robots.txt` and sitemap probes
- **P3-T7** Check result contract + `analyzePage` orchestrator + HTML fixture tests

### Phase 4 – Scoring and recommendations
- **P4-T1** `scoringConfig.js` (weights as data, not scattered numbers)
- **P4-T2** `scoreService` (categories, overall, coverage) + tests
- **P4-T3** `recommendationService` + tests

### Phase 5 – Persistence and API (→ M2, M3)
- **P5-T1** `Audit` model
- **P5-T2** `auditService` (create, list with search + pagination, get, delete)
- **P5-T3** Routes, controllers, request validation, strict analyze rate limiter
- **P5-T4** Postman collection (export to `docs/`) + supertest integration tests

### Phase 6 – Frontend foundation
- **P6-T1** Tailwind theme tokens (navy text, blue accent, status colours)
- **P6-T2** `AppLayout`, navigation, routes, 404
- **P6-T3** Base UI components
- **P6-T4** `apiClient`, `auditService`, error-to-message mapping, hooks

### Phase 7 – Frontend features on the real API (→ M4)
- **P7-T1** Analyze form + Overview page (hero, form, recent audits)
- **P7-T2** Results: score gauge, status summary cards, coverage notice
- **P7-T3** Category breakdown chart (Recharts) + full checks list with filters
- **P7-T4** Detail panels: headings, images, links, technical
- **P7-T5** Recommendations + "Could not verify" list
- **P7-T6** Audit History: search, pagination, delete with confirmation
- **P7-T7** Individual report page (`/audits/:id`) with loading/not-found states
- **P7-T8** About page: methodology, scoring explanation, disclaimer

### Phase 8 – Export and polish (→ M5)
- **P8-T1** CSV export
- **P8-T2** Print/PDF layout
- **P8-T3** Responsive and accessibility pass (keyboard, contrast, labels)

### Phase 9 – Release (→ M6)
- **P9-T1** Run the 10 test scenarios from the master requirements; fix bugs
- **P9-T2** Security review against Section 10
- **P9-T3** Final README (all required sections, screenshots), `.env.example` audit
- **P9-T4** Deployment config and live demo
- **P9-T5** Portfolio/LinkedIn write-up

---

## 13. Development Standards

**Code**
- JavaScript (ES modules) only, `async/await`, no callbacks, no TypeScript.
- Small files, single responsibility, no duplicated logic.
- Names: `camelCase` variables/functions · `PascalCase` React components and models · `kebab-case` not used for source files; files are named after their main export (`auditService.js`, `ScoreGauge.jsx`).
- Constants live in config files, not scattered magic numbers (especially scoring and limits).
- Comments explain **why**, not what.
- No `console.log` left in committed code; use a small logger wrapper.

**API:** nouns for resources, correct status codes, one response envelope (Section 5).

**React:** functional components + hooks; props for data in, callbacks out; loading, empty and error states for every data view; no business logic in JSX.

**Git:** branch per task (`feat/p2-t1-url-validator`); Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`); never commit `.env`; merge only after review.

**Review checklist (applied after every task)**
1. Does it meet every acceptance criterion?
2. Any unrelated files changed?
3. Errors handled and messages safe?
4. Any untrusted input used without validation?
5. Any duplicated logic or magic numbers?
6. Tests written and passing?
7. Does the app still start and the previous features still work?
8. Docs updated (progress log, decisions, README if relevant)?

---

## 14. Testing Strategy

| Level | Tool | What |
|---|---|---|
| Unit | `node:test` | URL validator, IP classifier, each SEO check, scoring, recommendations |
| Fixture | `node:test` + HTML files in `tests/fixtures/` | Pages: missing title, missing meta description, multiple H1, missing ALT, no viewport, noindex, etc. |
| SSRF | `node:test` + local HTTP server | Every blocked class; redirect-to-private; oversize; timeout; non-HTML |
| API integration | `supertest` + test database | All endpoints, status codes, error shapes, rate limiting |
| Manual API | Postman | Saved collection with happy path and every error code |
| Frontend manual | Browser + DevTools | Each page at mobile/tablet/desktop widths; all loading/error/empty states |
| Final acceptance | Manual matrix | The 10 scenarios from the master requirements (valid, invalid, unavailable, missing title, missing description, multiple H1, missing ALT, HTTP-only, redirect, non-HTML) |

Tests never hit the real internet; they use local fixtures and a local test server. Only the final manual acceptance run uses live sites.

---

## 15. Antigravity Prompt Workflow

For **every** task:

1. **You** tell me the task ID (e.g. "P2-T1"), or I propose the next one.
2. **I** explain the objective and approach in plain English.
3. **You** show me the relevant current files (paste or file tree) so I never assume what exists. In the first message of a prompt-writing session I will ask for the repo tree.
4. **I** write one copy-paste prompt using the template below.
5. **You** run it in Antigravity and bring back the diff/summary plus any errors.
6. **I** review it using the checklist in Section 13, list issues, and give you exact test steps.
7. **You** run the tests; we fix problems.
8. **I** update `DEVELOPMENT_PROGRESS.md` (and `TECHNICAL_DECISIONS.md` if a decision changed) and you commit.

**Prompt template**

Required structure (owner-approved 2026-11-20). Every prompt has these 13 sections, in this order:

```
# <Task ID> – <Task Name>

## 1. Objective
## 2. Current Project Context        (stack, phase, what earlier tasks produced – verified from repo tree)
## 3. Existing Functionality         (what already works and must not break)
## 4. Required Implementation        (precise behaviour, inputs, outputs, data shapes)
## 5. Technical Requirements         (MERN conventions, libraries allowed, standards)
## 6. Files to Inspect / Create / Modify   (exact paths; "inspect first" list)
## 7. UI/UX Requirements             (only if applicable)
## 8. Validation and Error Handling
## 9. Security Requirements
## 10. Testing Requirements          (tests to add, commands, expected output)
## 11. Acceptance Criteria           (checkbox list)
## 12. Constraints                   (no unrelated changes, no new deps, no mock data, no console.log, no secrets)
## 13. Expected Deliverables         (list of changed files, implementation notes, commands run, test output)
```

Every prompt starts by telling Antigravity to inspect the existing code before changing anything, and to stop and report if the repo does not match the described context. Each answer from Claude has three parts: a short explanation of what the task achieves, the single copy-paste prompt, and a short testing checklist.

---

## 16. Definition of Done (whole project)

- Every module in the master requirements implemented with real data.
- All 10 test scenarios pass; automated tests green.
- SSRF protections verified by automated tests.
- No secrets in the repo; `.env.example` complete.
- README complete with screenshots; docs up to date.
- Responsive from ~360 px to desktop.
- Public GitHub repo and a working demo link.

---

## 17. Open Items (need owner decision)

See `TECHNICAL_DECISIONS.md`, entries marked **Proposed** or **Open**: history privacy model (Q1), roadmap order (ADR-013), robots.txt policy (ADR-014), and approval of the optional dependencies in Section 11.
