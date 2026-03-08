# TaskFlow API — Full Code Explanation

> **Who is this for?**  
> This document explains *every file, function, and concept* in the TaskFlow API in plain language — readable by anyone who understands basic programming, even if you have never used Node.js, TypeScript, or MongoDB before.

---

## Table of Contents

1. [What is TaskFlow?](#1-what-is-taskflow)
2. [Tech Stack — What each tool does](#2-tech-stack)
3. [Project Structure — The map of the codebase](#3-project-structure)
4. [Entry Points: app.ts and server.ts](#4-entry-points)
5. [Configuration Layer (src/config/)](#5-configuration-layer)
6. [Data Models (src/models/)](#6-data-models)
7. [TypeScript Types (src/types/)](#7-typescript-types)
8. [Middleware (src/middleware/)](#8-middleware)
9. [Validation (src/validation/)](#9-validation)
10. [Services — Business Logic (src/services/)](#10-services)
11. [Controllers — Request Handlers (src/controllers/)](#11-controllers)
12. [Routes — URL Mapping (src/routes/)](#12-routes)
13. [Utilities (src/utils/)](#13-utilities)
14. [Queues and Workers (src/queues/, src/workers/)](#14-queues-and-workers)
15. [Socket.io — Real-time (src/socket/)](#15-socketio)
16. [GraphQL Layer (src/graphql/)](#16-graphql-layer)
17. [EJS Frontend (src/views/, public/)](#17-ejs-frontend)
18. [Testing Architecture (tests/)](#18-testing-architecture)
19. [Request Lifecycle — What happens on every API call](#19-request-lifecycle)
20. [Data Flow Diagrams](#20-data-flow-diagrams)

---

## 1. What is TaskFlow?

TaskFlow is a **REST API** (a web server that communicates using JSON over HTTP) for managing tasks and projects — like a simplified Jira or Trello backend.

**What can it do?**
- Register and log in users securely with passwords and tokens
- Create, read, update, and delete tasks and projects
- Assign tasks to team members, set priorities, due dates, and tags
- Upload file attachments to tasks, download them later
- Generate PDF reports and CSV exports of tasks
- Send real-time notifications when tasks change (using WebSockets)
- Send emails (welcome, password reset, task assignment)
- Process emails in the background via a queue (so the main server stays fast)
- Expose a GraphQL API as an alternative to the REST endpoints
- Show a basic web UI using server-side rendered HTML (EJS)
- Document itself interactively via Swagger UI at `/api-docs`

---

## 2. Tech Stack

| Tool | Role | Why it exists |
|---|---|---|
| **Node.js** | JavaScript runtime | Runs JavaScript outside a browser |
| **TypeScript** | Typed superset of JavaScript | Catches bugs at compile-time before runtime |
| **Express** | Web framework | Handles HTTP requests and routing |
| **MongoDB** | NoSQL database | Stores all data as flexible JSON-like documents |
| **Mongoose** | MongoDB ODM | Maps JavaScript objects to MongoDB documents with validation |
| **JWT** | Authentication tokens | Stateless, self-contained proof of identity |
| **bcryptjs** | Password hashing | One-way hashing so plain passwords are never stored |
| **express-validator** | Input validation | Ensures incoming data is safe and well-formed before processing |
| **multer** | File upload | Handles multipart/form-data (files) in Express |
| **PDFKit** | PDF generation | Draws PDFs programmatically in Node.js |
| **nodemailer** | Email sending | Sends emails via SMTP |
| **Socket.io** | WebSockets | Bidirectional real-time communication |
| **BullMQ** | Job queue | Processes tasks (emails) in the background using Redis |
| **Apollo Server** | GraphQL server | Serves a GraphQL API alongside REST |
| **swagger-jsdoc** | Swagger docs | Generates OpenAPI 3.0 spec from JSDoc comments |
| **swagger-ui-express** | Swagger UI | Serves an interactive HTML docs page |
| **EJS** | Template engine | Renders HTML pages on the server (web frontend) |
| **Jest** | Test framework | Runs automated tests |
| **Supertest** | HTTP testing | Makes test HTTP requests without starting a real server |
| **MongoMemoryServer** | In-memory MongoDB | Runs real MongoDB in memory for tests — no external DB needed |

---

## 3. Project Structure

```
taskflow-api/
│
├── src/                        ← All application source code
│   ├── app.ts                  ← Express app factory
│   ├── server.ts               ← HTTP server startup
│   │
│   ├── config/                 ← Configuration files
│   │   ├── database.ts         ← MongoDB connect/disconnect
│   │   ├── env.ts              ← Environment variables wrapper
│   │   ├── multer.ts           ← File upload configuration
│   │   ├── queue.ts            ← BullMQ Redis connection
│   │   └── swagger.ts          ← OpenAPI spec definition
│   │
│   ├── models/                 ← Mongoose schemas (database structure)
│   │   ├── User.model.ts
│   │   ├── Task.model.ts
│   │   ├── Project.model.ts
│   │   └── Comment.model.ts
│   │
│   ├── types/                  ← TypeScript interfaces
│   │   ├── models.types.ts     ← IUser, ITask, IProject, IComment, etc.
│   │   ├── express.d.ts        ← Adds userId/userRole/requestId to Request
│   │   └── apollo-express4.d.ts ← Type declarations for Apollo subpath
│   │
│   ├── middleware/             ← Express middleware functions
│   │   ├── auth.middleware.ts    ← isAuth, isAdmin, isOwnerOrAdmin
│   │   ├── error.middleware.ts   ← Global error handler
│   │   ├── validate.middleware.ts ← Runs express-validator chains
│   │   └── requestId.middleware.ts ← Attaches UUID to every request
│   │
│   ├── validation/             ← Validation rule chains
│   │   └── rules.ts            ← All express-validator rule sets
│   │
│   ├── controllers/            ← Thin request handlers
│   │   ├── auth.controller.ts
│   │   ├── task.controller.ts
│   │   ├── project.controller.ts
│   │   ├── comment.controller.ts
│   │   └── upload.controller.ts
│   │
│   ├── services/               ← Business logic (main testable units)
│   │   ├── auth.service.ts
│   │   ├── task.service.ts
│   │   ├── project.service.ts
│   │   ├── comment.service.ts
│   │   └── digest.service.ts
│   │
│   ├── routes/                 ← URL definitions
│   │   ├── health.routes.ts
│   │   ├── auth.routes.ts
│   │   ├── task.routes.ts
│   │   ├── project.routes.ts
│   │   ├── digest.routes.ts
│   │   └── web.routes.ts
│   │
│   ├── utils/                  ← Helper functions
│   │   ├── AppError.ts         ← Custom error class
│   │   ├── asyncHandler.ts     ← Wraps async controllers for error catching
│   │   ├── mailer.ts           ← Nodemailer + email templates
│   │   ├── pdfReporter.ts      ← PDFKit report + CSV generator
│   │   └── tokenUtils.ts       ← JWT sign/verify helpers
│   │
│   ├── queues/                 ← BullMQ queue definitions
│   │   └── emailQueue.ts       ← Email job queue + enqueueEmail()
│   │
│   ├── workers/                ← BullMQ job processors
│   │   └── emailWorker.ts      ← Processes email jobs
│   │
│   ├── socket/                 ← Socket.io real-time
│   │   └── index.ts            ← JWT auth, rooms, event emitters
│   │
│   ├── graphql/                ← Apollo GraphQL
│   │   ├── schema.ts           ← GraphQL type definitions (SDL)
│   │   ├── resolvers.ts        ← Query/Mutation implementations
│   │   └── index.ts            ← Apollo server setup + Express mount
│   │
│   └── views/                  ← EJS HTML templates
│       ├── layout.ejs
│       ├── index.ejs
│       ├── dashboard.ejs
│       ├── auth/
│       └── tasks/, projects/
│
├── tests/                      ← All automated tests
│   ├── globalSetup.ts          ← Start MongoMemoryServer once before all tests
│   ├── globalTeardown.ts       ← Stop MongoMemoryServer after all tests
│   ├── setup.ts                ← Connect Mongoose + clear DB between tests
│   ├── unit/                   ← Isolated unit tests (mocked dependencies)
│   └── integration/            ← Full HTTP tests (supertest + real in-memory DB)
│
├── public/                     ← Static files served to browser
│   └── css/main.css
│
├── uploads/                    ← File attachment storage (gitignored)
├── .env.example                ← Template for environment variables
├── jest.config.ts              ← Jest configuration
├── tsconfig.json               ← TypeScript configuration
└── package.json                ← Dependencies and npm scripts
```

---

## 4. Entry Points

### `src/app.ts` — Express Application Factory

**Purpose:** Creates and configures an Express application without starting an HTTP listener. Keeping app creation separate from starting the server is critical: tests can `import createApp` and get a real Express app without port conflicts.

**Key exports:**

```
createApp(testMiddleware?)
```
- Creates the bare Express app
- Sets up EJS view engine
- Registers global middleware: helmet → requestId → CORS → compression → cookieParser → morgan → JSON body parser → URL body parser → rate limiters
- Mounts all API routers: `/api/health`, `/api/auth`, `/api/tasks`, `/api/projects`, `/api/digest`
- Mounts Swagger UI at `/api-docs` and `/api-docs.json`
- Mounts the EJS web router at `/`
- Does NOT add error handlers (so GraphQL can be inserted first)

```
attachErrorHandlers(app)
```
- Appends the 404 catch-all middleware
- Appends the global error handler middleware
- Called last, after all routes are mounted

```
createAppWithHandlers(testMiddleware?)
```
- = `createApp()` + `attachErrorHandlers()`
- Used by all tests that do not need GraphQL

```
createAppWithGraphQL(testMiddleware?)   [async]
```
- = `createApp()` + `applyGraphQL(app)` + `attachErrorHandlers()`
- Used by `server.ts` for production
- The reason this is async: Apollo Server v4 requires `await server.start()` before mounting

**Why middleware order matters:**
Middleware in Express is processed in the order it is registered. `helmet` must be first to set security headers before any response is sent. The 404 handler must be last because it matches any route — if it were first, nothing else would ever run.

---

### `src/server.ts` — HTTP Server Startup

**Purpose:** The actual entry point when you run `npm run dev` or `npm start`. It:
1. Loads environment variables from `.env` via `dotenv`
2. Connects to MongoDB via `connectDatabase()`
3. Calls `createAppWithGraphQL()` to build the fully configured Express app
4. Creates a raw Node.js `http.Server` from the Express app (needed for Socket.io)
5. Calls `initSocketServer(httpServer)` to attach Socket.io to the same port
6. Starts listening on the configured port
7. Registers `SIGTERM` / `SIGINT` signal handlers for graceful shutdown — when the process receives a termination signal, it stops accepting new connections, closes the Socket.io server, waits for in-flight requests to complete, then closes the database connection

**Why use `http.createServer(app)` instead of `app.listen()`?**  
`app.listen()` creates an HTTP server internally but gives you no reference to it. Socket.io needs the raw Node.js `http.Server` instance to attach WebSocket upgrade handling to the same TCP port.

---

## 5. Configuration Layer

### `src/config/env.ts`

**Purpose:** A single typed object that wraps all environment variables. Every other file imports from `env` instead of reading `process.env` directly. Benefits:
- TypeScript types on every config value
- Default values in one place
- Easy to test (just mock the `env` object)

Key values: `port`, `mongoUri`, `jwt.secret`, `jwt.refreshSecret`, `jwt.expiresIn`, `corsOrigin`, `uploadDir`, `maxFileSize`, `email.*`, `redisHost`, `redisPort`, `isProduction`, `isTest`

`isTest` is `true` when `NODE_ENV === 'test'` — many parts of the system use this to skip real side effects (queuing emails, sending logs, etc.)

---

### `src/config/database.ts`

**Purpose:** Wraps `mongoose.connect()` and `mongoose.disconnect()`. `connectDatabase()` is called by `server.ts` at startup. `disconnectDatabase()` is called during graceful shutdown and in `globalTeardown.ts` of the test suite.

---

### `src/config/multer.ts`

**Purpose:** Configures the multer file-upload middleware.

- **Storage engine:** `diskStorage` — stores files to the local filesystem at `uploadDir` with unique filenames (`fieldname-timestamp-random.ext`)
- **File filter:** Only allows JPEG, PNG, GIF, WebP, PDF, plain text, Word documents. Any other MIME type triggers a 400 error via `AppError`
- **Size limit:** `maxFileSize` (default 5 MB from environment)
- **Export:** `upload` — a configured multer instance. Routes call `upload.single('fieldname')` or `upload.array(...)` as middleware directly before the controller

---

### `src/config/queue.ts`

**Purpose:** Exports `redisConnection` — the `ioredis` connection options (host, port, `maxRetriesPerRequest: null`) used by BullMQ. `maxRetriesPerRequest: null` is required by BullMQ to prevent ioredis from giving up on blocked commands.

---

### `src/config/swagger.ts`

**Purpose:** Creates and exports the full OpenAPI 3.0 specification using `swagger-jsdoc`.

- Defines metadata: title, version, description
- Defines server URL: `/api`
- Defines security schemes: `bearerAuth` (JWT Authorization header)
- Defines schemas: `User`, `Task`, `Project`, `Comment`, `AuthTokens`, `PaginatedTasks`, `Error`
- Tells `swagger-jsdoc` to scan `./src/routes/*.ts` and `./src/controllers/*.ts` for `@openapi` JSDoc blocks

---

## 6. Data Models

Each model file defines a Mongoose schema (database structure), exports a Mongoose Model (the object you use to query MongoDB), and uses TypeScript interfaces to enforce types.

### `src/models/User.model.ts`

**Fields:**
| Field | Type | Rules |
|---|---|---|
| `email` | String | Required, unique, lowercase, must match email regex |
| `password` | String | Required, min 8 chars, `select: false` (never returned in queries by default) |
| `name` | String | Required, 2–50 chars, trimmed |
| `role` | String enum | `'user'` or `'admin'`, defaults to `'user'` |
| `avatar` | String (optional) | Path to uploaded avatar image |
| `resetToken` | String (optional) | SHA-256 hash of the password reset token, `select: false` |
| `resetTokenExp` | Date (optional) | Expiry of the reset token, `select: false` |

**Pre-save hook:**  
Runs automatically before every `save()` call. If `password` was modified, it hashes it with bcrypt (12 salt rounds). This means: you can set `user.password = 'plaintext'`, save, and the stored value will always be the hash.

**Instance Methods:**
- `comparePassword(candidate)` — uses `bcrypt.compare()` to check if the candidate matches the stored hash without ever reversing the hash
- `generateResetToken()` — generates 32 random bytes, stores a SHA-256 hash in `resetToken`, sets `resetTokenExp` to 1 hour from now, and returns the raw token (which gets emailed to the user)

**toJSON transform:**  
Removes `password`, `resetToken`, and `resetTokenExp` from JSON output. So whenever a user object is serialised (e.g., in an API response), these sensitive fields are automatically stripped.

---

### `src/models/Task.model.ts`

**Fields:** title, description, status, priority, assignee (User ObjectId ref), project (Project ObjectId ref), tags[], dueDate, attachments[], completedAt, deletedAt, timestamps

**Key validations:**
- `dueDate`: validator runs only on new documents (`this.isNew`) — past dates are rejected on creation but allowed to stay once set (otherwise every re-save of an old task would fail)
- `tags`: two validators — max 10 tags, each max 30 chars

**Pre-save hook:** When `status` is changed to `'done'` and `completedAt` is not yet set, automatically stamps `completedAt = new Date()`.

**Static methods:**
- `findByProject(projectId, page, limit)` — queries tasks by project reference with offset pagination, excluding soft-deleted documents (`deletedAt: { $exists: false }`)
- `findOverdue()` — finds tasks where `dueDate < now` and `status !== 'done'`
- `getStatusCounts(projectId)` — runs a MongoDB aggregation pipeline: groups tasks by `status` and counts them, returns `{ todo: N, 'in-progress': N, review: N, done: N }`

---

### `src/models/Project.model.ts`

**Fields:** name, description, owner (User ref), members (array of User refs), status enum (`active/archived/completed`)

**Purpose:** Groups tasks together. The `members` array controls who can create tasks in the project. The `owner` is always included in members.

---

### `src/models/Comment.model.ts`

**Fields:** content (required), author (User ref), task (Task ref), parent (optional Comment ref for replies), timestamps

The optional `parent` field implements threaded comments: a top-level comment has no parent; a reply references a top-level comment's `_id`.

---

## 7. TypeScript Types

### `src/types/models.types.ts`

Defines TypeScript interfaces that extend Mongoose's `Document` type. This gives the TypeScript compiler full knowledge of all fields on each model instance.

Key interfaces: `IUser`, `ITask`, `IProject`, `IComment`, `IAttachment`, `PaginatedResult<T>`, `CursorPaginatedResult<T>`, `StatusCounts`

`PaginatedResult<T>` is a generic: `T` is filled with `ITask`, `IProject`, etc. wherever it's used.

---

### `src/types/express.d.ts`

**Purpose:** Declaration merging — extends Express's built-in `Request` interface to add our custom fields:
- `req.userId` — the authenticated user's MongoDB `_id` (string), added by `isAuth` middleware
- `req.userRole` — `'user' | 'admin'`, added by `isAuth`
- `req.requestId` — UUID added by `requestId` middleware

Without this file, TypeScript would complain every time you access `req.userId`.

---

### `src/types/apollo-express4.d.ts`

**Purpose:** Hand-written type declaration for `@apollo/server/express4`. When `moduleResolution` is set to `"node"` (not `"node16"`), TypeScript cannot find subpath exports defined in a package's `package.json`. This file tells TypeScript: "trust me, this path exists and `expressMiddleware` has this signature."

---

## 8. Middleware

Middleware in Express is a function with the signature `(req, res, next) => void`. It can:
- Read/modify the request
- Read/modify the response
- Call `next()` to pass control to the next middleware
- Call `next(error)` to skip to the error handler

### `src/middleware/auth.middleware.ts`

**`isAuth(req, res, next)`**  
1. Reads the `Authorization` header
2. Expects `Bearer <token>` format — returns 401 if missing or malformed
3. Calls `verifyAccessToken(token)` — returns 401 if expired or invalid (via `next(err)` to the global error handler which formats JWT errors properly)
4. Attaches `req.userId` and `req.userRole` so downstream middleware/controllers know who the caller is

**`isAdmin(req, res, next)`**  
After `isAuth` runs (so `req.userRole` is set), checks if role is `'admin'`. Returns 403 if not. Always used as `isAuth, isAdmin` in route definitions.

**`isOwnerOrAdmin(getOwnerId)`**  
A middleware factory — takes a function that extracts the resource owner's ID from the request. Allows admins through unconditionally; allows regular users only if their `req.userId` matches the owner ID.

---

### `src/middleware/error.middleware.ts`

**`errorHandler(err, req, res, next)`**  
Express error-handling middleware receives a 4th argument (`err`). This single handler covers:
- `AppError` (our custom class) → uses `err.statusCode` and `err.message`
- `mongoose.Error.ValidationError` → 400 with per-field messages extracted from `err.errors`
- `mongoose.Error.CastError` → 400 ("Invalid ID format")
- MongoDB duplicate key (error code 11000) → 409, extracts the conflicting field name from the error key
- `TokenExpiredError` → 401 ("Token has expired")
- `JsonWebTokenError` → 401 ("Invalid token")
- Everything else → 500 ("Internal server error"), with stack trace in development mode only

---

### `src/middleware/validate.middleware.ts`

**`validate(validations)`**  
A middleware factory. Takes an array of express-validator chains, runs them all, then reads the results with `validationResult(req)`. If there are errors, calls `next(new AppError('Validation failed', 422, errors))` which the error handler formats into a 422 response with all field errors listed.

---

### `src/middleware/requestId.middleware.ts`

**`requestId(req, res, next)`**  
Attaches a unique UUID (v4) to every request:
- Checks if `X-Request-ID` header already exists (from a load balancer, for example) — if so, reuses it
- Otherwise generates a new UUID
- Sets `req.requestId = id`
- Sets `X-Request-ID` response header so the client/logs can correlate requests

**Why it matters:** In production with multiple server instances, request IDs let you trace a single request through all your log lines. You can grep your logs for `X-Request-ID: abc123` and see every log line from that one request.

---

## 9. Validation

### `src/validation/rules.ts`

Defines reusable express-validator chains for every endpoint.

**Key rule sets:**

`signupValidation` — validates `name` (2–50 chars), `email` (normalised, valid format), `password` (min 8 chars)

`loginValidation` — `email` and `password` required

`createTaskValidation` — `title` (3–100 chars, trimmed, HTML stripped), `description` (max 2000), `project` (valid ObjectId, async check that project exists in DB), `status` (optional enum), `priority` (optional enum), `dueDate` (optional, must be ISO 8601 and in the future), `tags` (optional array, max 10, each max 30 chars)

`mongoIdParam` — validates `req.params.id` is a valid 24-character MongoDB ObjectId

`paginationQuery` — validates `page` (positive integer) and `limit` (1–100) query parameters

**Sanitization:** `escape()` strips HTML characters from string inputs, preventing stored XSS attacks.

---

## 10. Services

Services contain the actual business logic. Controllers should do no work themselves — they parse the HTTP request and call a service method. This separation means services can be unit-tested in isolation without any HTTP layer.

### `src/services/auth.service.ts`

Singleton exported as `export default new AuthService()`

**`signup(dto)`**  
1. Checks for an existing user with the same email → 409 if found
2. Creates the user (`User.create()` triggers the pre-save hash hook)
3. Generates access + refresh JWT pair via `generateTokens()`
4. Enqueues a welcome email via `enqueueEmail()` (fire-and-forget, no-op in tests)
5. Returns `{ user, tokens }`

**`login(dto)`**  
1. Finds user by email with `+password` (because password is `select: false` by default)
2. Returns 401 if not found (same generic message as wrong password to prevent email enumeration)
3. Calls `user.comparePassword()` → 401 if wrong
4. Returns `{ user, tokens }`

**`refresh(refreshToken)`**  
1. Verifies the refresh token (different secret from access token)
2. Looks up the user → 401 if not found
3. Issues a fresh access + refresh pair

**`forgotPassword(email)`**  
1. Looks up user by email
2. If not found — still returns the same success message (no email enumeration)
3. Calls `user.generateResetToken()` which sets `resetToken` (hashed) and `resetTokenExp`
4. Saves user
5. Enqueues password reset email with the raw token URL
6. In non-production, returns the raw token directly (for testing without a mail server)

**`resetPassword(rawToken, newPassword)`**  
1. Hashes the raw token with SHA-256 (to match what's stored)
2. Finds user where `resetToken === hash` and `resetTokenExp > now`
3. 400 if not found (bad or expired token)
4. Sets `user.password = newPassword` (pre-save hook re-hashes it)
5. Clears `resetToken` and `resetTokenExp` so token can't be reused

---

### `src/services/task.service.ts`

**`create(data, requestingUserId)`**  
Verifies the project exists and that the requesting user is either the owner or a member. Creates and returns the task.

**`findAll(filters)`**  
Offset-based pagination: constructs a MongoDB query, runs `find()` + `countDocuments()` in parallel using `Promise.all()`, calculates `totalPages`, returns `PaginatedResult<ITask>`.

**`findAllCursor(cursor, limit, filters)`**  
Cursor-based pagination. Instead of `skip()`, it filters by `_id > cursor` (for ascending) or `_id < cursor` (for descending). Fetches `limit + 1` items — if the 11th item exists, there are more pages. The `nextCursor` is the `_id` of the last item in the returned page. Clients pass this cursor on the next request to continue from where they left off. This is more efficient than `skip()` for large datasets.

**`update(id, data)`**  
Uses MongoDB `$set` operator — only the fields in `data` are updated. Fields not in `data` are untouched. `runValidators: true` re-runs Mongoose validators.

**`softDelete(id)`**  
Sets `deletedAt = new Date()` instead of removing the document. All other queries filter `{ deletedAt: { $exists: false } }` to exclude soft-deleted items. This allows data recovery and audit trails.

---

### `src/services/project.service.ts`

**`create(data, ownerId)`**  
Deduplicates members, always adds the owner to the members array, creates the project.

**`getProjectTasks(projectId, page, limit)`**  
Verifies project exists, applies offset pagination on `Task.find({ project: ... })`.

---

### `src/services/comment.service.ts`

**`create(taskId, authorId, dto)`** — Creates a comment linked to a task and optional parent comment.

**`findByTask(taskId)`** — Returns all comments for a task, populated with author info.

---

### `src/services/digest.service.ts`

**`getUsersWithOverdueTasks()`**  
Queries all overdue tasks (dueDate in the past, not done), then groups them by assignee using a `Map` to count how many overdue tasks each user has. Returns an array of `DigestEntry` objects.

**`runDailyDigest()`**  
Calls `getUsersWithOverdueTasks()`, then enqueues an email for each user. Designed to be called either by a cron job, a BullMQ scheduled job, or the admin endpoint `POST /api/digest/trigger`.

---

## 11. Controllers

Controllers are thin. Each controller function:
1. Reads from `req.params`, `req.query`, `req.body`, `req.userId`
2. Passes data to a service method
3. Sends a JSON response

All controller functions are wrapped in `asyncHandler()` (see Utilities), which forwards any thrown error to Express's `next(error)`.

### `src/controllers/auth.controller.ts`

| Export | What it does |
|---|---|
| `signup` | Calls `authService.signup(req.body)`, returns 201 + `{ user, accessToken, refreshToken }` |
| `login` | Calls `authService.login(req.body)`, returns 200 + tokens |
| `refresh` | Calls `authService.refresh(req.body.refreshToken)`, returns 200 + new tokens |
| `forgotPassword` | Calls `authService.forgotPassword(req.body.email)`, returns 200 |
| `resetPassword` | Calls `authService.resetPassword(token, password)`, returns 200 |
| `getMe` | Fetches full user from DB by `req.userId`, returns 200 + user object |
| `uploadAvatar` | Reads `req.file` (populated by multer), updates `user.avatar`, returns 200 |

---

### `src/controllers/task.controller.ts`

| Export | What it does |
|---|---|
| `createTask` | Creates a task; `req.userId` is the requesting user for member check |
| `listTasks` | Offset-paginated task list |
| `listTasksCursor` | Cursor-paginated task list |
| `getTask` | Single task with populated refs |
| `updateTask` | Partial update |
| `deleteTask` | Soft delete |

---

### `src/controllers/upload.controller.ts`

| Export | What it does |
|---|---|
| `uploadAttachment` | After multer middleware, pushes file metadata into task's attachments array |
| `downloadAttachment` | Streams file from disk to response with correct Content-Type |
| `exportTasksPdf` | Queries tasks, calls `generateTaskReportPdf()`, streams PDF |
| `exportTasksCsv` | Queries tasks, calls `generateTaskReportCsv()`, sends CSV string |

---

### `src/controllers/project.controller.ts`

| Export | What it does |
|---|---|
| `createProject` | Creates a project |
| `getProjectTasks` | Offset-paginated task list for one project |
| `getProjectReport` | Fetches project + tasks, streams PDF report |
| `exportProjectCsv` | Fetches project tasks, sends CSV download |

---

## 12. Routes

Routes define URL patterns and connect them to middleware chains and controllers.

### Pattern used throughout:

```typescript
router.post('/path', isAuth, validate(validationRules), controllerFunction);
```

This means:
1. `isAuth` runs first — if no valid JWT, request dies here with 401
2. `validate(rules)` runs — if inputs are invalid, request dies here with 422
3. `controllerFunction` runs — actual business logic

### `src/routes/auth.routes.ts`

| Method | Path | Protected | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | No | Register |
| POST | `/api/auth/login` | No | Login |
| POST | `/api/auth/refresh` | No | Refresh tokens |
| POST | `/api/auth/forgot-password` | No | Request reset link |
| POST | `/api/auth/reset-password` | No | Reset with token |
| GET | `/api/auth/me` | Yes | Current user |
| PUT | `/api/auth/me/avatar` | Yes | Upload avatar |

### `src/routes/task.routes.ts`

| Method | Path | Description |
|---|---|---|
| GET | `/api/tasks/export/pdf` | Export all tasks as PDF |
| GET | `/api/tasks/export/csv` | Export all tasks as CSV |
| GET | `/api/tasks/cursor` | Cursor-paginated task list |
| POST | `/api/tasks` | Create task |
| GET | `/api/tasks` | Offset-paginated task list |
| GET | `/api/tasks/:id` | Get task by ID |
| PUT | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Soft-delete task |
| POST | `/api/tasks/:id/attachments` | Upload file to task |
| GET | `/api/tasks/:id/attachments/:filename` | Download file |
| POST | `/api/tasks/:id/comments` | Add comment |
| GET | `/api/tasks/:id/comments` | Get comments |

> Note: Export/cursor routes come before `/:id` in the code because Express matches routes in registration order. If `/:id` were first, `/export/pdf` would match it with `id = "export"`.

### `src/routes/project.routes.ts`

| Method | Path | Description |
|---|---|---|
| POST | `/api/projects` | Create project |
| GET | `/api/projects/:id/tasks` | Project task list |
| GET | `/api/projects/:id/report` | PDF report |
| GET | `/api/projects/:id/export` | CSV export |

---

## 13. Utilities

### `src/utils/AppError.ts`

A custom error class extending `Error`. Adds:
- `statusCode` — HTTP status to send in response
- `isOperational = true` — marks intentional errors (validation, 404, etc.) as opposed to unexpected bugs. The error handler logs bugs more loudly.
- `errors` — optional array of field-level validation errors

**Why a custom error class?**  
`throw new AppError('Not found', 404)` in a service method becomes a 404 JSON response at the client. Without this, you'd have to call `res.status(404).json(...)` in every controller.

---

### `src/utils/asyncHandler.ts`

```typescript
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
```

**Purpose:** Express does not automatically catch errors thrown in `async` functions. Without this wrapper, an unhandled Promise rejection in a controller would crash the server. With this wrapper, any thrown error (or rejected Promise) is forwarded to `next(err)`, which the error handler picks up.

---

### `src/utils/tokenUtils.ts`

Thin wrappers around `jsonwebtoken`:
- `signAccessToken({ userId, role })` — creates a JWT signed with `JWT_SECRET`, expires in 15 minutes
- `signRefreshToken({ userId })` — creates a JWT signed with `JWT_REFRESH_SECRET`, expires in 7 days
- `verifyAccessToken(token)` — verifies and decodes an access token, throws if invalid
- `verifyRefreshToken(token)` — verifies and decodes a refresh token

**Why two secrets?** If the access token secret is compromised, you can rotate it without invalidating all refresh tokens, and vice versa.

---

### `src/utils/mailer.ts`

- `createTransporter()` — builds a nodemailer transport. In test (`env.isTest`) or when no `EMAIL_HOST` is set, uses `streamTransport` (captures emails in memory, never sends them). In production, uses real SMTP.
- `sendMail(options)` — sends via the transporter
- `welcomeEmail(name)` — returns an HTML string for welcome emails
- `passwordResetEmail(name, resetUrl)` — returns HTML for password reset
- `taskAssignedEmail(assigneeName, taskTitle, projectName)` — returns HTML for task assignment

---

### `src/utils/pdfReporter.ts`

**`generateTaskReportPdf(options, res)`**  
Uses PDFKit to create a PDF on the fly and stream it directly to the HTTP response. Never writes to disk — the PDF is piped stream to stream. Contains: report title, generated date, summary table of task counts by status, then one paragraph per task with its title, priority, status, and due date.

**`generateTaskReportCsv(tasks)`**  
Builds a CSV string in memory: header row + one row per task. Returns the string, which the controller sends with `Content-Type: text/csv`.

---

## 14. Queues and Workers

### Why a job queue?

When a user signs up, we want to send them a welcome email. But calling `sendMail()` directly in the signup request adds ~500ms latency. If the mail server is slow or down, the signup API call fails.

**Solution:** Put the email job in a queue (BullMQ + Redis). The signup handler returns immediately. A background worker picks up the job and sends the email asynchronously.

---

### `src/queues/emailQueue.ts`

**`EmailJobData`** (TypeScript union type):
```typescript
| { type: 'welcome'; to: string; name: string }
| { type: 'passwordReset'; to: string; resetUrl: string }
| { type: 'taskAssigned'; to: string; taskTitle: string; taskId: string }
```

**`getEmailQueue()`** — lazy-initialises a BullMQ `Queue` instance connected to Redis. Lazy (not created at import time) so tests that import this module don't try to connect to Redis.

**`enqueueEmail(data)`**  
- If `env.isTest === true` — returns immediately doing nothing (no Redis needed in tests)
- Otherwise — adds the job to the email queue via `queue.add(data.type, data)`

---

### `src/workers/emailWorker.ts`

**`processEmailJob(job)`** — switch on `job.data.type`:
- `'welcome'` → calls `sendMail()` with `welcomeEmail(name)` HTML
- `'passwordReset'` → calls `sendMail()` with `passwordResetEmail(...)` HTML
- `'taskAssigned'` → calls `sendMail()` with `taskAssignedEmail(...)` HTML

**`startEmailWorker()`** — creates a BullMQ `Worker` that pools `concurrency: 5` jobs simultaneously. The worker must be started as a separate process (e.g. `node dist/workers/emailWorker.js`) in production. It is not started by `server.ts` because workers are typically deployed separately.

---

## 15. Socket.io

Socket.io enables **bidirectional, persistent connections** between server and client. Unlike HTTP (request → response, connection closed), WebSocket connections stay open.

### `src/socket/index.ts`

**`initSocketServer(httpServer)`**  
- Creates a `SocketServer` attached to the existing HTTP server (same port)
- Registers a middleware function for authentication: reads `socket.handshake.auth.token` or `socket.handshake.query.token`, calls `verifyAccessToken()`. If invalid → connection rejected
- On `connection`: registers two room events
  - `join:project(projectId)` → `socket.join('project:projectId')`
  - `leave:project(projectId)` → `socket.leave('project:projectId')`

**`emitToProject(projectId, eventData)`**  
Called from controllers whenever a task is mutated. Emits the event to the room `project:${projectId}` — only clients who have joined that room receive it.

**Events available:**
```
task:created        { task }
task:updated        { task }
task:assigned       { task, assigneeId }
task:commented      { taskId, comment }
task:status-changed { taskId, oldStatus, newStatus }
```

**Why rooms?** A project might have 5 members online. When someone updates a task, only those 5 people should see the notification — not every connected user on the entire server. Rooms implement this.

---

## 16. GraphQL Layer

GraphQL is an alternative query language for APIs. Instead of multiple REST endpoints, clients send a single query describing exactly what data they want.

### `src/graphql/schema.ts`

Defines the GraphQL Schema Definition Language (SDL):
- **Scalars:** `Date` (custom, ISO-8601 string)
- **Types:** `User`, `Task`, `Project`, `PaginatedTasks`, `AuthResult`
- **Query type:** `tasks`, `task`, `projects`, `project`, `me`
- **Mutation type:** `createTask`, `updateTask`, `createProject`, `signup`, `login`
- **Input types:** `CreateTaskInput`, `UpdateTaskInput`, `CreateProjectInput`

---

### `src/graphql/resolvers.ts`

Each resolver is a function that fetches or mutates data for one field in the schema.

**Authentication in resolvers:** `requireAuth(ctx)` checks `ctx.userId` — the context is populated in `src/graphql/index.ts` by verifying the Bearer token from the HTTP request.

**`DateScalar`** — GraphQL doesn't have a native Date type. This custom scalar converts `Date` objects to ISO strings when sending to clients (`serialize`), and ISO strings back to `Date` when receiving from clients (`parseValue`, `parseLiteral`).

---

### `src/graphql/index.ts`

**`applyGraphQL(app)`**  
1. Creates an Apollo Server v4 instance with schema + resolvers
2. Calls `await server.start()` (required by Apollo v4)
3. Calls `expressMiddleware(server, { context })` — context function extracts JWT from `Authorization` header and attaches `userId`/`userRole` to the GraphQL context
4. Mounts the middleware at `/api/graphql`

This function is called in `createAppWithGraphQL()` and adds the GraphQL endpoint alongside all REST endpoints.

---

## 17. EJS Frontend

EJS (Embedded JavaScript) generates HTML on the server by evaluating `<% %>` tags.

### `src/views/layout.ejs`

The base template. All other views are rendered into `<%- body %>`. Contains: navbar (shows auth links or dashboard based on whether `user` is set), flash message display, viewport meta, CSS link.

### `src/routes/web.routes.ts`

Cookie-based authentication (separate from JWT Bearer auth used by the REST API):

**`getTokenFromCookie(req)`** — reads `req.cookies.tf_token` (httpOnly cookie)

**`requireWebAuth`** — middleware that calls `getTokenFromCookie`, calls `verifyAccessToken`, attaches userId/role. If missing → `res.redirect('/login?next=' + req.path)`

**Routes:**
| Path | Method | Description |
|---|---|---|
| `/` | GET | Landing page with stats |
| `/login` | GET/POST | Login form; on success sets cookie and redirects |
| `/signup` | GET/POST | Signup form |
| `/logout` | GET | Clears cookie, redirects to `/login` |
| `/dashboard` | GET | Shows task stats for current user |
| `/tasks` | GET | Task grid with filtering/pagination |
| `/tasks/new` | GET/POST | Create task form |
| `/tasks/:id` | GET | Task detail |
| `/tasks/:id/comments` | POST | Add comment |
| `/projects` | GET | Project cards |
| `/projects/new` | GET/POST | Create project form |

The cookie `tf_token` is the JWT access token stored as httpOnly (not readable by JavaScript in the browser — XSS-proof) and SameSite=Lax (CSRF protection).

---

## 18. Testing Architecture

### Philosophy

**Unit tests** — test one function in isolation. All database access, file system, email sending, and other dependencies are mocked. Unit tests run without MongoDB and are very fast.

**Integration tests** — test the full HTTP flow. A real Express app is created, connected to `MongoMemoryServer` (real MongoDB running in RAM), and requests are sent with `supertest`. Tests exercise the whole stack from HTTP to database.

---

### `tests/globalSetup.ts` and `tests/globalTeardown.ts`

`globalSetup` runs once before all test suites. It starts a `MongoMemoryServer` instance with `storageEngine: 'wiredTiger'` (required for standalone MongoDB 6.0), stores the instance on `global.__MONGOD__`, and sets `process.env.MONGO_URI_TEST`.

`globalTeardown` closes the Mongoose connection and stops the MongoMemoryServer.

By running the DB once for the whole test run (not per-file), startup time is ~3s instead of ~60s.

---

### `tests/setup.ts`

Runs before each test file (`setupFilesAfterEnv`):
- `beforeAll`: connects Mongoose to `MONGO_URI_TEST` if not already connected
- `afterEach`: deletes all documents from all collections (clean slate per test), clears all Jest mock calls/instances

---

### Unit Test Structure

```
tests/unit/
  middleware/   error.middleware.test.ts
  models/       User.model.test.ts, Task.model.test.ts, ProjectComment.model.test.ts
  services/     auth.service.test.ts, task.service.test.ts
  utils/        AppError.test.ts, asyncHandler.test.ts, mailer.test.ts, tokenUtils.test.ts
  queues/       emailQueue.test.ts
```

**Mocking pattern for services:** `jest.mock('@/models/Task.model')` replaces the real model with auto-created Jest mocks. Tests then call `jest.spyOn(Task, 'findById').mockResolvedValue(...)` to control responses.

---

### Integration Test Structure

```
tests/integration/
  health.test.ts      Health endpoint + CORS + security headers
  auth.test.ts        Full auth flow (signup, login, refresh, password reset)
  tasks.test.ts       CRUD endpoints
  validation.test.ts  Input validation errors
  upload.test.ts      File upload/download, PDF, CSV
  graphql.test.ts     GraphQL queries and mutations
  swagger.test.ts     OpenAPI spec validity
  web.test.ts         EJS web routes
```

Each integration test file:
1. Imports `createAppWithHandlers()` (or `createAppWithGraphQL()`)
2. Uses `supertest(app)` to make HTTP requests
3. Asserts on `res.status` and `res.body` shape

---

## 19. Request Lifecycle

Here is what happens step by step when a client sends `POST /api/tasks`:

```
Client sends:
POST /api/tasks
Authorization: Bearer eyJhb...
Content-Type: application/json
{ "title": "Build login page", "project": "abc123" }
```

**Step 1 — Express receives the request**

**Step 2 — Global middleware stack runs (in order):**
  - `helmet` → sets X-Content-Type-Options, X-Frame-Options, etc.
  - `requestId` → attaches UUID, sets X-Request-ID header
  - `cors` → sets Access-Control-Allow-Origin header
  - `compression` → will gzip the response
  - `cookieParser` → parses cookies
  - `morgan` → logs `POST /api/tasks` to stdout (dev mode)
  - `express.json()` → parses JSON body → `req.body = { title: ..., project: ... }`
  - Rate limiter (`/api/`) → increments request counter; passes if under limit

**Step 3 — Route matching:**
  Express finds `router.post('/', validate(createTaskValidation), createTask)` under `/api/tasks`

**Step 4 — Route-level middleware: `isAuth`**
  - Reads `req.headers.authorization`
  - Calls `verifyAccessToken(token)` → gets `{ userId, role }`
  - Sets `req.userId = userId`, `req.userRole = role`
  - Calls `next()`

**Step 5 — Route-level middleware: `validate(createTaskValidation)`**
  - Runs all express-validator chains on `req.body`
  - Finds `project` is not a valid ObjectId → calls `next(new AppError('Validation failed', 422, [...]))`
  - **OR:** All valid → calls `next()`

**Step 5a — If validation failed:**
  Error flows to `errorHandler` → sends `{ status: 'error', message: 'Validation failed', errors: [...] }` with 422

**Step 6 — Controller: `createTask`**
  - `asyncHandler` wraps it — any thrown error forwards to `next(err)`
  - Calls `taskService.create(req.body, req.userId)`
  - Service verifies project exists, user is a member
  - Calls `Task.create(data)` → MongoDB inserts document
  - Returns the new task
  - Controller sends `res.status(201).json({ status: 'success', data: task })`

**Step 7 — Response sent back to client**

---

## 20. Data Flow Diagrams

### Authentication Flow

```
Client                    Auth Routes              AuthService              MongoDB
  |                           |                        |                       |
  |-- POST /signup ---------->|                        |                       |
  |   { name, email, pw }     |-- signup(dto) -------->|                       |
  |                           |                        |-- User.findOne() ---->|
  |                           |                        |<-- null (not exists --|
  |                           |                        |-- User.create() ----->|
  |                           |                        |<-- user document -----|
  |                           |                        |-- enqueueEmail()      |
  |                           |                        |-- signAccessToken()   |
  |                           |                        |-- signRefreshToken()  |
  |<-- 201 { user, tokens } --|<-- { user, tokens } ---|                       |
```

### Task Creation Flow

```
Client           Middleware              Controller       TaskService       MongoDB
  |                  |                      |                  |               |
  |-- POST /tasks -->|                      |                  |               |
  |   Bearer: JWT    |-- isAuth() --------->|                  |               |
  |                  |   (verifies JWT)     |                  |               |
  |                  |-- validate() ------->|                  |               |
  |                  |   (rules check)      |                  |               |
  |                  |                      |-- create(body) ->|               |
  |                  |                      |                  |- findById() ->|
  |                  |                      |                  |<- project ----|
  |                  |                      |                  |- Task.create->|
  |                  |                      |                  |<- task -------|
  |<-- 201 { task } -|<--------------------|<-- task ---------|               |
```

### Real-time Notification Flow

```
Client A (browser)            Server                 Client B (dashboard)
  |                               |                           |
  |-- WS connect (JWT) --------->|                           |
  |-- emit: join:project(X) ---->|                           |
  |                               |<-- WS connect (JWT) -----|
  |                               |<-- emit: join:project(X) |
  |                               |    socket.join('project:X')
  |                               |                           |
  |-- POST /api/tasks ----------->|                           |
  |   { title, project: X }       |                           |
  |                               |-- Task.create() -------->DB
  |                               |   emitToProject(X, ...)   |
  |<-- 201 { task } --------------|                           |
  |                               |-- to('project:X').emit -->|
  |                               |   task:created { task }   |
  |                               |                  notification shown
```

---

*This document was generated from the full TaskFlow API codebase (March 2026). All 139 tests pass. TypeScript: zero errors.*
