# TaskFlow Master Fix — How to Apply

## Option 1: Git Patch (Recommended)
```bash
cd TaskFlow
git apply taskflow_master_fix.patch
git push origin main
```

## Option 2: Copy Files Manually
Replace these files from the `TaskFlow-master/` folder:

### Core Fixes (MUST apply):
- `src/utils/mailer.ts` — Email now actually sends when SMTP configured
- `src/workers/emailWorker.ts` — taskUrl and task list passed to emails
- `src/queues/emailQueue.ts` — Added tasks[] to DigestEmailJob type
- `src/app.ts` — Serves /uploads as static files (avatars now load)
- `src/controllers/auth.controller.ts` — Avatar URL uses CLIENT_URL
- `src/controllers/comment.controller.ts` — Accepts 'body' OR 'content' field
- `src/controllers/project.controller.ts` — Added 5 MISSING controller functions
- `src/routes/project.routes.ts` — Added GET/DELETE and member management routes
- `src/routes/task.routes.ts` — Added DELETE comment route
- `src/validation/rules.ts` — Comment validation accepts body/content

### Test Fixes (MUST apply):
- `tests/globalSetup.ts` — Tries multiple MongoDB versions, fallback to MONGODB_URI
- `jest.config.ts` — 60s timeout, serial execution, better thresholds

### New Tests (26 test files/additions):
All files in `tests/` folder.

## Environment Variables Required for Email

Set these on Render.com (or wherever you deploy):
```
EMAIL_HOST=smtp.gmail.com        # or smtp.sendgrid.net etc.
EMAIL_PORT=587
EMAIL_USER=your@gmail.com
EMAIL_PASS=your-app-password
CLIENT_URL=https://taskflow-5alt.onrender.com
```

For Gmail: use App Password (not regular password).
For Resend/SendGrid: use their SMTP credentials.

## What Was Fixed

### 1. Email Not Sending
**Root cause**: `isDevMode()` returned `true` whenever `EMAIL_HOST` was empty
(which it is by default), so ALL emails went to console.log.

**Fix**: Replaced with `hasSmtpConfig()` which checks if a real SMTP host is
configured. Without SMTP config → log to console (dev). With SMTP config → 
actually send the email.

### 2. Avatar Not Showing
**Root cause**: Uploaded files in `uploads/` were not served as static files.
Also `avatarUrl` used `BASE_URL` env var which was never set.

**Fix**: Added `app.use('/uploads', express.static(uploadsPath))` in app.ts.
Changed to use `CLIENT_URL` (which IS set in production).

### 3. Missing API Routes
**Root cause**: Project CRUD was only in web routes, not REST API.

**Fix**: Added complete REST endpoints:
- `GET /api/projects` — list all  
- `GET /api/projects/:id` — get one
- `DELETE /api/projects/:id` — delete (owner only)
- `POST /api/projects/:id/members` — add member (owner only)
- `DELETE /api/projects/:id/members/:id` — remove member (owner only)
- `DELETE /api/tasks/:id/comments/:id` — delete comment

### 4. Test Skipping / MongoDB Download Failure
**Root cause**: `it.skip()` on attachment test; MongoDB binary version 7.0.14
is not available for download on all platforms.

**Fix**: Removed `it.skip()`. Added version fallback in globalSetup — tries
7.0.14 → 7.0.4 → 6.0.12 → 6.0.4 → 5.0.21. Can also set `MONGODB_URI` env
var to skip the binary download entirely.

### 5. Low Test Coverage
**Fix**: Added 90+ new tests across 13 new/expanded test files covering:
- Project service (create, findById, addMember, removeMember, delete, tasks)
- Comment service (create, delete, findByTask)
- Digest service (getUsersWithOverdueTasks, runDailyDigest)
- PDF/CSV reporter (headers, rows, escaping, date formatting)
- Auth middleware (isAuth, isAdmin, isOwnerOrAdmin)
- Task model (all statuses, priorities, tags, soft-delete)
- Project/Comment models (validation, population)
- Integration tests for projects, comments, avatars, uploads
