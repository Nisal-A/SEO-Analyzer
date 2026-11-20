# SEOCheck

> **Work in progress – Phase 0/1 (Foundation).**

SEOCheck is a full-stack MERN application that safely fetches a single public web page, runs rule-based on-page SEO checks and produces a transparent **educational audit score** out of 100.

> SEOCheck is **not** an official Google score. It is an educational audit based on documented rules.

## Tech stack

- **Client:** React + Vite, Tailwind CSS, React Router, Axios, Recharts, Lucide icons
- **Server:** Node.js 22+, Express 5, Mongoose (MongoDB Atlas), Helmet, CORS, express-rate-limit
- **Tests:** `node:test` + Supertest

Plain JavaScript (ES modules) only. No TypeScript.

## Prerequisites

- Node.js **22 LTS or newer** (the server uses `--env-file`, `--watch` and `node:test`)
- npm
- A MongoDB Atlas cluster (free tier is fine)

## Getting started

```bash
npm install                                  # installs client + server workspaces
cp server/.env.example server/.env           # then set MONGODB_URI
cp client/.env.example client/.env
npm run dev                                  # API on :5000, client on :5173
```

## Scripts (root)

| Script | What it does |
|---|---|
| `npm run dev` | Runs the API and the client together (`concurrently`) |
| `npm test` | Runs the server test suite |
| `npm run build` | Builds the client for production |

## Project documentation

- [Project Master Plan](./PROJECT_MASTER_PLAN.md)
- [Technical Decisions](./TECHNICAL_DECISIONS.md)
- [Development Progress](./DEVELOPMENT_PROGRESS.md)
