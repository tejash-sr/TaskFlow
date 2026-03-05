<div align="center">

# TaskFlow API

**Production-grade task management platform built with Node.js, TypeScript, and MongoDB**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.x-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Jest](https://img.shields.io/badge/Tests-139%20passing-C21325?logo=jest&logoColor=white)](https://jestjs.io/)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

[Features](#-features)  [Quick Start](#-quick-start)  [API Reference](#-api-reference)  [Architecture](#-architecture)  [Testing](#-testing)

</div>

---

## Overview

TaskFlow is a full-featured task management REST API built as a Grootan Technologies internal training exercise.  
It covers **8 progressive phases** — from basic CRUD through GraphQL, real-time events, file handling, and email delivery — all with **139+ passing tests**.

The project also ships with a fully server-rendered **EJS frontend** (sidebar app shell, professional design system, responsive layout) accessible at `http://localhost:5000`.

---

## Features

| Category | Capability |
|---|---|
| **Authentication** | JWT access + refresh token rotation, email verification, password reset |
| **Tasks** | Full CRUD, status workflow, priority levels, due dates, labels, soft delete |
| **Projects** | Create projects, add members, list project tasks |
| **Comments** | Threaded comments on tasks |
| **File Attachments** | multer upload, task attachment management |
| **Reports** | PDF task report (PDFKit), CSV export |
| **Real-time** | Socket.io — live task create/update/delete events |
| **GraphQL** | Apollo Server 4 — full task & user schema |
| **Email** | Nodemailer — verification, password reset, weekly digest |
| **Job Queues** | BullMQ + Redis — digest email scheduling |
| **API Docs** | Swagger UI at `/api-docs` |
| **Frontend** | EJS server-rendered UI (landing, auth, dashboard, tasks, projects) |
| **Health** | `/api/health` with DB status |
| **Validation** | express-validator on all mutation endpoints |

---

## Tech Stack

```
Runtime        Node.js 20+ · TypeScript 5+
Framework      Express 4 · express-validator
Database       MongoDB 7 · Mongoose 8 ODM
Auth           jsonwebtoken · bcryptjs · cookie-based web sessions
Testing        Jest · ts-jest · Supertest · mongodb-memory-server
GraphQL        Apollo Server 4 · graphql 16
Real-time      Socket.io 4
Email          Nodemailer (mocked in tests)
Queues         BullMQ · ioredis
File Upload    multer · PDFKit · csv-writer
API Docs       Swagger UI Express · swagger-jsdoc
Frontend       EJS · Inter font · custom design system
```

---

## Project Structure

```
.
├── src/
│   ├── config/          # Environment, database, CORS, Swagger, queue
│   ├── controllers/     # Thin route handlers — delegate to services
│   ├── graphql/         # Apollo schema, resolvers, context
│   ├── middleware/      # Auth, validation, error, upload, rate-limit, requestId
│   ├── models/          # Mongoose schemas + TypeScript interfaces
│   ├── queues/          # BullMQ queue definitions
│   ├── routes/          # Express route definitions (REST + web)
│   ├── services/        # Business logic — primary unit-test targets
│   ├── socket/          # Socket.io event handlers
│   ├── types/           # Shared TypeScript types + Express augmentations
│   ├── utils/           # AppError, asyncHandler, token/date/mailer helpers
│   ├── views/           # EJS templates (layout, auth, dashboard, tasks, projects)
│   ├── workers/         # BullMQ workers
│   ├── app.ts           # Express app factory (no listen — testable)
│   └── server.ts        # HTTP + Socket.io server startup
│
├── tests/
│   ├── integration/     # Supertest + mongodb-memory-server
│   └── unit/            # Isolated mocked service/util tests
│
├── public/
│   └── css/main.css     # Design system (Inter, Indigo palette, sidebar layout)
│
├── tsconfig.json        # IDE / type-check config (noEmit)
├── tsconfig.build.json  # Emit-only build config
└── tsconfig.test.json   # Thin wrapper for Jest
```

---

## Quick Start

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20+ | [Download](https://nodejs.org/) |
| MongoDB | 6+ | Local or [Atlas](https://www.mongodb.com/atlas) |
| Redis | 7+ | Optional — required for digest queues only |

### Installation

```bash
# 1. Clone
git clone <repo-url>
cd grootan-nodejs-testing-exercise-tejash

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env — fill in MONGO_URI, JWT_SECRET, JWT_REFRESH_SECRET
```

### Environment Variables

```dotenv
NODE_ENV=development
PORT=5000

# MongoDB
MONGO_URI=mongodb://localhost:27017/taskflow

# JWT — use long random strings
JWT_SECRET=your-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Email (optional — mocked in tests)
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=noreply@example.com
EMAIL_PASSWORD=

# Redis (optional — for BullMQ queues)
REDIS_URL=redis://localhost:6379

# File uploads
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880
```

### Running

```bash
# Development (ts-node with hot reload)
npm run dev

# Build to JavaScript
npm run build

# Run compiled build
npm start

# Run all tests (139 passing)
npm test

# Run tests with coverage
npm run test:coverage
```

The web frontend is available at **http://localhost:5000**  
Swagger API docs at **http://localhost:5000/api-docs**  
GraphQL Playground at **http://localhost:5000/graphql**

---

## API Reference

Base URL: `http://localhost:5000/api`

All authenticated endpoints require the `Authorization: Bearer <token>` header.

### Authentication

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/auth/signup` | Register new user | No |
| `POST` | `/auth/login` | Login — returns access + refresh tokens | No |
| `POST` | `/auth/refresh` | Rotate refresh token | No |
| `GET` | `/auth/me` | Get current user profile | Yes |
| `PUT` | `/auth/me` | Update profile | Yes |
| `POST` | `/auth/forgot-password` | Send reset email | No |
| `POST` | `/auth/reset-password/:token` | Reset password | No |
| `GET` | `/auth/verify/:token` | Verify email address | No |
| `POST` | `/auth/logout` | Invalidate refresh token | Yes |

### Tasks

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/tasks` | List tasks (pagination, filter by status/priority) | Yes |
| `POST` | `/tasks` | Create task | Yes |
| `GET` | `/tasks/:id` | Get task by ID | Yes |
| `PUT` | `/tasks/:id` | Update task | Yes |
| `DELETE` | `/tasks/:id` | Soft delete task | Yes |
| `GET` | `/tasks/export/pdf` | Export all tasks as PDF | Yes |
| `GET` | `/tasks/export/csv` | Export all tasks as CSV | Yes |
| `POST` | `/tasks/:id/attachments` | Upload file to task | Yes |
| `GET` | `/tasks/:id/attachments` | List task attachments | Yes |

**Query Parameters for `GET /tasks`**

| Param | Type | Example |
|---|---|---|
| `page` | number | `?page=2` |
| `limit` | number | `?limit=20` |
| `status` | string | `?status=in-progress` |
| `priority` | string | `?priority=high` |
| `assignee` | ObjectId | `?assignee=...` |
| `project` | ObjectId | `?project=...` |

**Task Status Values:** `todo` · `in-progress` · `review` · `done`  
**Task Priority Values:** `low` · `medium` · `high` · `critical`

### Projects

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/projects` | List all projects | Yes |
| `POST` | `/projects` | Create project | Yes |
| `GET` | `/projects/:id` | Get project by ID | Yes |
| `PUT` | `/projects/:id` | Update project | Yes |
| `DELETE` | `/projects/:id` | Delete project | Yes |
| `GET` | `/projects/:id/tasks` | List tasks in project | Yes |

### Comments

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/tasks/:id/comments` | List comments on a task | Yes |
| `POST` | `/tasks/:id/comments` | Add comment | Yes |
| `DELETE` | `/tasks/:taskId/comments/:id` | Delete comment | Yes |

### Example Request

```bash
# Register
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","password":"Password1!"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Password1!"}'

# Create task (replace TOKEN)
curl -X POST http://localhost:5000/api/tasks \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Fix bug","status":"todo","priority":"high","project":"PROJECT_ID"}'
```

---

## GraphQL

Apollo Sandbox available at `http://localhost:5000/graphql`

```graphql
# List tasks
query {
  tasks(page: 1, limit: 10) {
    data { id title status priority dueDate }
    total
    totalPages
  }
}

# Create task
mutation {
  createTask(input: {
    title: "Deploy to staging"
    status: todo
    priority: high
    project: "PROJECT_ID"
  }) {
    id title status
  }
}
```

---

## Architecture

```
HTTP Request
    │
    ▼
Express Router
    │
    ▼
Middleware (requestId → auth → validation → body-parser)
    │
    ▼
Controller (thin — validates presence, calls service)
    │
    ▼
Service Layer (business logic, Mongoose queries)
    │
    ▼
Mongoose Model ──→ MongoDB
    │
    ▼
JSON Response / EJS render
```

**Key Design Principles**

- **Service-layer architecture** — controllers stay thin; all business logic lives in services
- **Testability** — `app.ts` exports a pure Express app factory with no `listen()` call; tests import it directly
- **Three tsconfig approach** — `tsconfig.json` for IDE + `tsc --noEmit`; `tsconfig.build.json` for `dist/` emit; `tsconfig.test.json` wraps root for Jest
- **Error handling** — `AppError` class extends `Error` with HTTP status codes; global `errorHandler` middleware formats all responses consistently

---

## Testing

```bash
npm test                  # All tests (139 passing, 19 suites)
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only
npm run test:coverage     # Coverage report
```

**Test suites**

| Suite | Tests | Coverage Area |
|---|---|---|
| `auth.test.ts` | 24 | Registration, login, token rotation, password reset |
| `task.test.ts` | 22 | CRUD, filtering, pagination, soft delete |
| `project.test.ts` | 14 | Create, update, members, project tasks |
| `comment.test.ts` | 8 | Comment CRUD, task association |
| `upload.test.ts` | 6 | File upload, attachment listing |
| `validation.test.ts` | 12 | Input validation on all mutation routes |
| `health.test.ts` | 3 | Health check, DB status |
| `graphql.test.ts` | 18 | Query and mutation resolvers |
| `web.test.ts` | 10 | EJS frontend page rendering |
| `swagger.test.ts` | 4 | API docs availability |
| Unit (utils) | 18 | Token utils, date utils, AppError, mailer |

**Infrastructure**
- `mongodb-memory-server` — spins up an ephemeral MongoDB per test run; no external DB required
- Nodemailer `createTestAccount` mock — no real email is sent during tests
- Redis mocked via `ioredis-mock` for queue tests

---

## Real-time Events (Socket.io)

Connect to `http://localhost:5000` with Socket.io.  
Authenticate by passing your JWT in the `auth` handshake:

```js
const socket = io('http://localhost:5000', {
  auth: { token: 'Bearer YOUR_JWT' }
});

socket.on('task:created', (task) => console.log('New task:', task));
socket.on('task:updated', (task) => console.log('Updated:', task));
socket.on('task:deleted', ({ id }) => console.log('Deleted:', id));
```

---

## Frontend

The web frontend is a fully server-rendered **EJS** application with a custom design system.

| Route | Description |
|---|---|
| `/` | Landing page — hero, features, tech stack |
| `/signup` | Registration |
| `/login` | Sign in |
| `/forgot-password` | Password reset request |
| `/dashboard` | Stats, recent tasks, quick actions |
| `/tasks` | Task list with filter bar and pagination |
| `/tasks/new` | Create task form |
| `/tasks/:id` | Task detail — status update, comments, attachments |
| `/projects` | Project grid |
| `/projects/new` | Create project form |

**Design system:** Inter typeface  Indigo/Slate palette  CSS custom properties  Sidebar app-shell layout  SVG icons (no emoji)  Responsive at 768px breakpoint

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Write tests first (TDD encouraged)
4. Implement the feature
5. Run the full test suite: `npm test`
6. Commit: `git commit -m 'feat(scope): description'`
7. Push: `git push origin feature/my-feature`
8. Open a Pull Request

**Commit convention:** [Conventional Commits](https://www.conventionalcommits.org/)  
`feat`  `fix`  `docs`  `refactor`  `test`  `chore`

---

## Phase Roadmap

| Phase | Description | Status |
|---|---|---|
| 1 | Project setup, TypeScript config, health check | Done |
| 2 | User auth — JWT, refresh tokens, email verification | Done |
| 3 | Task CRUD — full REST API with filtering & pagination | Done |
| 4 | Projects & comments | Done |
| 5 | GraphQL — Apollo Server, full task schema | Done |
| 6 | File uploads, PDF/CSV export | Done |
| 7 | Socket.io real-time events | Done |
| 8 | Email notifications, BullMQ digest queue | Done |

---

## License

MIT — see [LICENSE](LICENSE)

---

<div align="center">
  Built as a Grootan Technologies internal training exercise
</div>
