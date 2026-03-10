# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server with hot reload (nodemon)
npm run build        # Compile TypeScript to dist/
npm start            # Run compiled production server
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

To run a single test file:
```bash
npx jest src/__tests__/controllers/authController.test.ts
```

## Architecture

Safe Frogs is a REST API backend for a knitting/crochet project tracker. Built with Express + TypeScript, PostgreSQL (raw SQL via `pg`), and JWT authentication.

**Request flow:** `routes/` → `middleware/auth.ts` (JWT guard) → `controllers/`

**Key directories:**
- `src/controllers/` — business logic with direct SQL queries (no ORM)
- `src/routes/` — route definitions, apply `authenticateToken` middleware to protected routes
- `src/middleware/auth.ts` — JWT validation, attaches `req.user` with `{ userId, username }`
- `src/config/database.ts` — PostgreSQL connection pool
- `src/config/schema.sql` — full DB schema (5 tables: users, projects, sections, lifelines, count_history)
- `src/__tests__/controllers/` — integration tests using Supertest against live DB

**Auth:** JWT tokens (7-day expiry), bcrypt password hashing. Protected endpoints require `Authorization: Bearer <token>`.

**Testing:** Tests run against the actual database and clean up via `DELETE WHERE email LIKE 'test%'` in `afterAll`. The test environment uses the same DB as development.

## Environment

Requires a `.env` file (not committed):
```
DB_USER=...
DB_HOST=localhost
DB_NAME=safe_frogs_db
DB_PASSWORD=...
DB_PORT=5432
JWT_SECRET=...
PORT=5000
```
