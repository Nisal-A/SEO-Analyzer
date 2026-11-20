# SEOCheck – Technical Decisions

Format: each decision has a **Status** (`Accepted` · `Proposed` · `Open`), the **decision**, **why**, and **alternatives rejected**. Update this file whenever a decision changes. Never silently reverse a decision.

---

## ADR-001 – MERN stack in plain JavaScript
**Status:** Accepted
**Decision:** React + Vite, Express, MongoDB/Mongoose, all in JavaScript (ES modules). No TypeScript.
**Why:** Matches the stated learning goals and keeps the learning curve on full-stack concepts, not typing.
**Rejected:** TypeScript (not requested; revisit only if you ask).

## ADR-002 – Monorepo with `client/` and `server/`
**Status:** Accepted
**Decision:** One Git repo; root `package.json` with npm workspaces for `client` and `server`, plus root convenience scripts powered by `concurrently` (`npm run dev`).
**Why:** One repo is easier to publish and demo; workspaces keep installs simple and `concurrently` lets developers start both servers in one command.
**Rejected:** Two repos (harder to present as one project).

## ADR-003 – Express 5
**Status:** Accepted
**Decision:** Use Express v5 (`express@5.3.0`).
**Why:** Rejected promises in async handlers reach the central error handler automatically, eliminating try/catch wrapper boilerplate.
**Rejected:** Express 4 (older, needs wrappers for async errors).

## ADR-004 – Prefer Node built-ins over extra packages
**Status:** Accepted
**Decision:** On Node 22+: `node --env-file=.env` (no `dotenv`), `node --watch` (no `nodemon`), `net.BlockList` (no IP-parsing library), `node:test` (no Jest).
**Why:** Fewer dependencies means less to learn, fewer vulnerabilities, and honours "no unnecessary dependencies".
**Trade-off:** Requires Node >= 22. Recorded in `engines` in `package.json`.
**Rejected:** `dotenv`, `nodemon`, `ipaddr.js`, Jest.

## ADR-005 – Required server packages beyond the stated stack
**Status:** Accepted
**Decision:** Include `helmet`, `cors`, `express-rate-limit`; dev-only `supertest`.
**Why:** Directly required by the security section (headers, strict CORS, rate limiting) and HTTP-level API testing. Each is small, widely used, and maintained.
**Rejected:** Hand-writing rate limiting (error-prone).

## ADR-006 – SSRF protection design
**Status:** Accepted
**Decision:**
1. Parse with the WHATWG `URL` class; allow `http:`/`https:` only; reject embedded credentials; allow ports 80/443 only; reject localhost-style hostnames (`localhost`, `*.localhost`, `*.local`, `*.internal`).
2. Resolve the hostname with `dns.promises.lookup({ all: true, verbatim: true })`; reject if **any** address is blocked.
3. Use a custom `lookup` on the HTTP/HTTPS agents so the connection goes to the **already validated IP** (prevents DNS rebinding between check and connect, supporting both single-address and Node 22 `{ all: true }` socket lookup signatures).
4. Block: `0.0.0.0/8`, `10/8`, `100.64/10`, `127/8`, `169.254/16`, `172.16/12`, `192.0.0/24`, `192.168/16`, `198.18/15`, `224/4`, `240/4`, `::`, `::1`, `fc00::/7`, `fe80::/10`, `ff00::/8`, and unwrapped IPv4-mapped IPv6 forms (dotted and hex) of all of these.
5. `maxRedirects: 0`; follow redirects manually (max 5), re-running steps 1–3 on every hop.
6. Ignore proxy environment variables for target fetches (`proxy: false`).
**Why:** URL-string checks alone are bypassable (decimal IPs, DNS tricks, redirects). Validating the resolved IP at connect time is the reliable approach.
**Rejected:** Hostname blocklist only; letting Axios follow redirects.

## ADR-007 – Resource limits on target fetches
**Status:** Accepted
**Decision:** 10 s overall deadline using `AbortController` (covering redirects and slow body streaming); 2 MB cap counted while streaming decompressed bytes; require `text/html` or `application/xhtml+xml` for main page fetches; fixed `User-Agent: SEOCheckBot/1.0`. All values come from env config with these defaults.
**Why:** Prevents hanging requests, memory exhaustion, and compressed-response bombs.

## ADR-008 – Check status model
**Status:** Accepted
**Decision:** Four statuses: `passed`, `warning`, `failed`, `not_tested`. Every `not_tested` check carries an explicit `reason` (e.g. `NETWORK_ERROR`, `BLOCKED_URL`, `NOT_APPLICABLE_NO_IMAGES`, `NO_H1_FOUND`).
**Why:** Never claim a pass that was not tested. A page with zero images is recorded as `not_tested` with a reason rather than a fake pass.

## ADR-009 – Scoring model
**Status:** Accepted
**Decision:** 100 points: Title 15, Meta description 15, Headings 15, Images 15, Links 10, Technical 30 (per-check points in `server/services/scoring/scoringConfig.js`). Passed = 100%, warning = 50%, failed = 0%. `not_tested` points are removed from both earned and possible, and `scoreCoverage` is stored and shown.
**Why:** Simple to explain, fully data-driven from `scoringConfig.js`, and honest about missing information.
**Rejected:** Treating untested checks as 0 (unfairly punishes unreachable `robots.txt`) or as full marks (dishonest).
**Note:** Weights are an educational judgement, not a Google formula. Displayed in the footer, report view, CSV export, print view, and About page.

## ADR-010 – What is stored in MongoDB
**Status:** Accepted
**Decision:** Store the derived report only (checks, scores, extracted headings/counts, capped samples). Never store raw HTML. Cap array lengths (50 headings per level, 20 samples, 10 redirect hops) and string lengths (200 chars). Add `schemaVersion: 1`. Failed fetches are not stored in v1.
**Why:** Meets "reproduce the report without refetching" and "avoid storing page content" while limiting document size and abuse. `schemaVersion` makes future migrations safe.

## ADR-011 – API response and error envelope
**Status:** Accepted
**Decision:** Success: `{ success: true, data, meta? }`. Error: `{ success: false, error: { code, message } }` with the fixed 13-code catalogue (Master Plan §5). Endpoint for analysis is `POST /api/audits/analyze`, returning `201`.
**Why:** The frontend maps `code` cleanly to friendly messages; internals and stack traces are never leaked.

## ADR-012 – Export approach
**Status:** Accepted
**Decision:** CSV is generated in the browser from the loaded audit (with RFC 4180 escaping and spreadsheet formula-injection neutralization); PDF is "Print / Save as PDF" through a `@media print` stylesheet.
**Why:** Zero server load, no export endpoint to secure, no heavy PDF/browser dependency.
**Rejected:** Server-side PDF generation (Puppeteer / jsPDF) for v1.

## ADR-013 – Roadmap order: backend-first
**Status:** Accepted
**Decision:** Build and test the secure fetch engine, SEO checks, scoring, persistence, and REST API before building the React UI against the real API.
**Why:** Keeps every screen backed by real data from day one with zero hardcoded placeholder audit results.

## ADR-014 – `robots.txt` policy for the audited page
**Status:** Accepted (Option B)
**Decision:** Do not block the main page audit based on `robots.txt`; fetch `/robots.txt` as a non-fatal technical probe via `safeFetch` and report its availability in `tech.robotsTxt` (`200` = pass, `404`/non-200 = warning, network/blocked error = `not_tested`). Any `Sitemap:` URL discovered in `robots.txt` is also validated through `safeFetch`.
**Why:** Keeps v1 straightforward with zero extra robots-parser dependency while still surfacing crawlability signals safely and respecting SSRF protections.
**Rejected:** Option A (blocking audit via custom robots parser) deferred to future enhancement.

## ADR-015 – Audit history privacy (no authentication in v1)
**Status:** Accepted (Option B)
**Decision:** Anonymous per-browser scoping: the React client generates a random UUID stored in `localStorage` (`seocheck_client_id`) and sends it in the `X-Client-Id` header. Audits store `ownerId` indexed with `{ ownerId: 1, analyzedAt: -1 }`, and API reads/deletes filter strictly by `ownerId` (falling back to `"anonymous-public"` when the header is omitted for direct Postman usage). Documented on the About page as a v1 privacy convenience rather than full account authentication.
**Why:** Prevents visitors on a deployed demo from seeing each other's audited URLs without introducing JWT/auth complexity in v1.
**Rejected:** Option A (single global history); Option C (full user accounts deferred to v2).

## ADR-016 – Frontend styling and charts
**Status:** Accepted
**Decision:** Tailwind CSS v4 with `@tailwindcss/vite`, design tokens defined in `client/src/index.css`: white/light-slate backgrounds (`#F8FAFC`), dark navy text (`#0F172A`), blue accent (`#2563EB`); green/amber/red/slate reserved for `passed`/`warning`/`failed`/`not_tested`. Recharts for radial score gauge and horizontal category breakdown chart. Status is never shown by colour alone (every badge pairs an icon + text label).

## ADR-017 – Testing approach
**Status:** Accepted
**Decision:** `node:test` for unit, HTML fixture, and local-server SSRF tests; `supertest` for REST API integration tests; Postman collection v2.1 exported to `docs/SEOCheck.postman_collection.json`; manual browser QA for the frontend.
**Why:** Minimal tooling with strong automated coverage on the highest-risk backend modules (SSRF, HTML parsing, scoring, recommendations, API validation).

## ADR-018 – Rate limiting
**Status:** Accepted
**Decision:** Per-IP `express-rate-limit`: analyze endpoint `10` requests / 15 min (`RATE_LIMIT_ANALYZE_PER_15MIN`); global API `200` requests / 15 min (`RATE_LIMIT_GLOBAL_PER_15MIN`). Configure `app.set('trust proxy', 1)` when `NODE_ENV === 'production'` so reverse-proxy deployments (Render/Railway) resolve real client IPs.
**Why:** Each analyze request performs outbound network calls, making it the primary abuse vector.

## ADR-019 – Git workflow
**Status:** Accepted
**Decision:** `main` stays buildable and green; Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`); `.env` files strictly git-ignored.

---

## Decision Change Log

| Date | ADR | Change |
|---|---|---|
| 2026-11-20 | All | Initial proposals drafted |
| 2026-11-20 | ADR-002 – ADR-019 | Marked Accepted for v1 release: locked `concurrently` (ADR-002), backend-first order (ADR-013), Option B for `robots.txt` probing (ADR-014), and Option B for `X-Client-Id` anonymous history scoping (ADR-015). |
