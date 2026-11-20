# SEOCheck – Technical Decisions

Format: each decision has a **Status** (Accepted from project instructions · Proposed – needs approval · Open), the **decision**, **why**, and **alternatives rejected**. Update this file whenever a decision changes. Never silently reverse a decision.

---

## ADR-001 – MERN stack in plain JavaScript
**Status:** Accepted (project instructions)
**Decision:** React + Vite, Express, MongoDB/Mongoose, all in JavaScript (ES modules). No TypeScript.
**Why:** Matches the stated learning goals and keeps the learning curve on full-stack concepts, not typing.
**Rejected:** TypeScript (not requested; revisit only if you ask).

## ADR-002 – Monorepo with `client/` and `server/`
**Status:** Proposed
**Decision:** One Git repo; root `package.json` with npm workspaces for `client` and `server`, plus root convenience scripts.
**Why:** One repo is easier to publish and demo; workspaces keep installs simple. Frontend and backend still have separate `package.json` files and responsibilities.
**Rejected:** Two repos (harder to present as one project).
**Note:** `concurrently` (run both with `npm run dev`) is optional. Without it, you run two terminals. Needs approval.

## ADR-003 – Express 5
**Status:** Proposed
**Decision:** Use current Express (v5).
**Why:** Rejected promises in async handlers reach the error handler automatically, so beginners need less try/catch boilerplate. It is the current default on npm.
**Rejected:** Express 4 (older, needs wrappers for async errors).

## ADR-004 – Prefer Node built-ins over extra packages
**Status:** Proposed
**Decision:** On Node 22+: `node --env-file=.env` (no `dotenv`), `node --watch` (no `nodemon`), `net.BlockList` (no IP-parsing library), `node:test` (no Jest).
**Why:** Fewer dependencies means less to learn, fewer vulnerabilities, and honours "no unnecessary dependencies".
**Trade-off:** Requires Node ≥ 22. Recorded in `engines` in `package.json`.
**Rejected:** `dotenv`, `nodemon`, `ipaddr.js`, Jest.

## ADR-005 – Required server packages beyond the stated stack
**Status:** Proposed – needs your approval
**Decision:** Add `helmet`, `cors`, `express-rate-limit`; dev-only `supertest`.
**Why:** Directly required by the security section (headers, CORS, rate limiting) and API testing. Each is small, widely used and maintained.
**Rejected:** Hand-writing rate limiting (error-prone).

## ADR-006 – SSRF protection design
**Status:** Proposed
**Decision:**
1. Parse with the WHATWG `URL` class; allow `http:`/`https:` only; reject embedded credentials; allow ports 80/443 only.
2. Resolve the hostname with `dns.lookup({ all: true })`; reject if **any** address is blocked.
3. Use a custom `lookup` on the HTTP/HTTPS agents so the connection goes to the **already validated IP** (prevents DNS rebinding between check and connect).
4. Block: `0.0.0.0/8`, `10/8`, `100.64/10`, `127/8`, `169.254/16`, `172.16/12`, `192.0.0/24`, `192.168/16`, `198.18/15`, `224/4`, `240/4`, `::`, `::1`, `fc00::/7`, `fe80::/10`, `ff00::/8`, and IPv4-mapped IPv6 forms of all of these.
5. `maxRedirects: 0`; follow redirects manually (max 5), re-running steps 1–3 on every hop.
6. Ignore proxy environment variables for target fetches (`proxy: false`).
**Why:** URL-string checks alone are bypassable (decimal IPs, DNS tricks, redirects). Validating the resolved IP at connect time is the reliable approach.
**Rejected:** Hostname blocklist only; letting Axios follow redirects.

## ADR-007 – Resource limits on target fetches
**Status:** Proposed
**Decision:** 10 s overall deadline using `AbortController` (Axios `timeout` alone does not cover a slow body); 2 MB cap counted while streaming decompressed bytes; require `text/html` or `application/xhtml+xml`; fixed `User-Agent: SEOCheckBot/1.0`. All values come from env config with these defaults.
**Why:** Prevents hanging requests, memory exhaustion and compressed-response bombs.

## ADR-008 – Check status model
**Status:** Accepted (project instructions), refined
**Decision:** Four statuses: `passed`, `warning`, `failed`, `not_tested`. Every `not_tested` check carries a `reason` (e.g. `NETWORK_ERROR`, `NOT_APPLICABLE_NO_IMAGES`).
**Why:** The project rule is never to claim a pass that was not tested. A page with zero images is recorded as `not_tested` with a reason rather than a fake pass.

## ADR-009 – Scoring model
**Status:** Proposed
**Decision:** 100 points: Title 15, Meta description 15, Headings 15, Images 15, Links 10, Technical 30 (per-check points in the Master Plan). Passed = 100%, warning = 50%, failed = 0%. `not_tested` points are removed from both earned and possible, and `scoreCoverage` is stored and shown.
**Why:** Simple to explain, fully data-driven from `scoringConfig.js`, and honest about missing information.
**Rejected:** Treating untested checks as 0 (unfairly punishes unreachable `robots.txt`) or as full marks (dishonest).
**Note:** Weights are an educational judgement, not a Google formula. The About page must say so.

## ADR-010 – What is stored in MongoDB
**Status:** Proposed
**Decision:** Store the derived report only (checks, scores, extracted headings/counts, capped samples). Never store raw HTML. Cap array lengths and string lengths. Add `schemaVersion`. Failed fetches are not stored in v1.
**Why:** Meets "reproduce the report without refetching" and "avoid storing page content" while limiting document size and abuse. `schemaVersion` makes future migrations safe.

## ADR-011 – API response and error envelope
**Status:** Proposed
**Decision:** Success: `{ success: true, data, meta? }`. Error: `{ success: false, error: { code, message } }` with a fixed list of codes (Master Plan §5). Endpoint for analysis is `POST /api/audits/analyze` as in the master requirements, returning `201`.
**Why:** The frontend can map `code` to friendly messages; internals are never leaked.
**Note:** `POST /api/audits` would be more purely RESTful, but `/analyze` is kept because it is in your requirements and describes a verb-like action clearly.

## ADR-012 – Export approach
**Status:** Proposed
**Decision:** CSV is generated in the browser from the loaded audit; PDF is "Print / Save as PDF" through a print stylesheet.
**Why:** No server load, no endpoint to secure, no PDF library. A headless-browser PDF (Puppeteer) is heavy and a new technology that would need separate approval.
**Rejected:** Server-side PDF generation for v1.

## ADR-013 – Roadmap order: backend-first
**Status:** Open – needs your approval (deviates from master prompt order)
**Decision proposed:** Build and test the secure engine and API (Postman) **before** the main UI, then build the UI directly against the real API.
**Why:** The master requirements say UI first (Phase 2) then backend. Building UI first almost forces placeholder data, which your rules forbid. Backend-first keeps every screen real from day one and lets you demo the API early.
**Alternative:** Follow the original order but limit Phase 6 to layout/navigation/static components with no data (acceptable if you prefer seeing visuals early).

## ADR-014 – robots.txt policy for the audited page
**Status:** Open
**Question:** Your objectives say "pages that permit automated access". Should SEOCheck check the target's `robots.txt` and **refuse to audit** a page it disallows for our user-agent?
**Options:**
- **A (recommended):** Respect it. If `robots.txt` disallows our user-agent for that path, refuse with a clear message. Needs a small robots parser (hand-written or one small package, approval required).
- **B:** Do not block; still report in the `tech.robotsTxt` check that the page is disallowed for crawlers in general. Simpler, but less aligned with "do not bypass access restrictions".
**Impact:** Affects P2-T4 / P3-T6.

## ADR-015 – Audit history privacy (no authentication in v1)
**Status:** Open
**Problem:** Without accounts, a deployed app would show every visitor everyone else's audited URLs.
**Options:**
- **A:** Single global history (fine for a local/private demo only).
- **B (recommended):** Anonymous per-browser scope: the client generates a random ID stored in `localStorage` and sends it in an `X-Client-Id` header; audits and history are filtered by it. No login, no new libraries. It is a privacy convenience, not strong security (anyone with the ID can see that history), and must be documented as such.
- **C:** Real user accounts (JWT/sessions). Large extra scope and new dependencies; would be a Phase 10 enhancement.
**Impact:** Adds `ownerId` to the `audits` model and API filters; must be decided before P5-T1.

## ADR-016 – Frontend styling and charts
**Status:** Accepted (project instructions)
**Decision:** Tailwind CSS (current major version with its Vite plugin), design tokens defined once in the theme: white/light-grey backgrounds, dark navy text, blue accent; green/orange/red reserved for passed/warning/failed. Recharts for the category chart and score visual. Status is never shown by colour alone (icon + label too) for accessibility.

## ADR-017 – Testing approach
**Status:** Proposed
**Decision:** `node:test` for unit/fixture/SSRF tests; `supertest` for API integration against a separate test database; Postman collection exported to `docs/`. Frontend tests (Vitest + React Testing Library) are optional and need approval; manual browser testing is mandatory.
**Why:** Minimal tooling, strong coverage where the risk is (SSRF, scoring, parsing).

## ADR-018 – Rate limiting
**Status:** Proposed
**Decision:** Per-IP: analyze endpoint 10 requests / 15 min; global API 200 / 15 min (both configurable). Set `trust proxy` correctly when deployed behind a host's proxy so real client IPs are used.
**Why:** Each analyze request triggers outbound network calls, so it is the costly and abusable endpoint.

## ADR-019 – Git workflow
**Status:** Proposed
**Decision:** `main` always works; one feature branch per task; Conventional Commits; merge after review.

---

## Decision Change Log

| Date | ADR | Change |
|---|---|---|
| 2026-11-20 | All | Initial proposals drafted |
