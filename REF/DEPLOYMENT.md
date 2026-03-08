# TaskFlow API — Deployment & Local Setup Guide

## Table of Contents

1. [Local Development Setup](#1-local-development-setup)
2. [Environment Variables](#2-environment-variables)
3. [Running the Application](#3-running-the-application)
4. [Git Branching Strategy](#4-git-branching-strategy)
5. [GitLab CI/CD Pipeline](#5-gitlab-cicd-pipeline)
6. [Version Tags (Phase Releases)](#6-version-tags-phase-releases)
7. [Deploying to Vercel](#7-deploying-to-vercel)
8. [Deploying to VPS with PM2](#8-deploying-to-vps-with-pm2)
9. [Recommended Cloud Platform (Railway)](#9-recommended-cloud-platform-railway)

---

## 1. Local Development Setup

### Prerequisites

| Tool | Version | Download |
|------|---------|---------|
| Node.js | ≥ 20 LTS | https://nodejs.org |
| MongoDB | ≥ 7.0 | https://www.mongodb.com/try/download/community |
| MongoDB Compass | latest | https://www.mongodb.com/try/download/compass |
| Redis | ≥ 7.0 | https://redis.io/download (Windows: see below) |
| Git | latest | https://git-scm.com |

---

### Step 1 — Install Node.js

1. Download **Node.js 20 LTS** from https://nodejs.org
2. Install with default settings
3. Verify:
   ```powershell
   node --version   # v20.x.x
   npm --version    # 10.x.x
   ```

---

### Step 2 — Install & Start MongoDB

You already have MongoDB Compass, which means MongoDB is installed.

**Start MongoDB as a service (Windows):**
```powershell
# Option A — Windows Service (runs on boot automatically)
net start MongoDB

# Option B — Manual start (if not installed as service)
mongod --dbpath "C:\data\db"
```

**Verify MongoDB is running:**
Open MongoDB Compass → connect to `mongodb://localhost:27017` → you should see the connection succeed.

**Create the database:**  
The app auto-creates the `taskflow` database on first run. No manual setup needed.

---

### Step 3 — Install Redis (Windows)

TaskFlow uses Redis through **BullMQ** for the email notification queue.

**Option A — Redis via WSL2 (recommended on Windows):**
```powershell
# 1. Enable WSL2 (run as Administrator)
wsl --install

# 2. Open Ubuntu terminal, then:
sudo apt update
sudo apt install redis-server
sudo service redis-server start

# Verify
redis-cli ping   # should return: PONG
```

**Option B — Redis via Docker Desktop:**
```powershell
# Pull and run Redis container
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Verify
docker exec -it redis redis-cli ping   # PONG
```

**Option C — Memurai (Windows-native Redis port):**
Download Memurai (a Windows-native Redis 7 port) from https://www.memurai.com  
Install and it runs as a Windows service on port 6379.

> **Note:** If Redis is NOT running, TaskFlow still works — the email queue simply logs to console instead of processing background jobs. You will see a warning in the logs but the app won't crash.

---

### Step 4 — Clone & Install Dependencies

```powershell
# Clone the repo
git clone https://gitlab.grootan.com/interns-2026/grootan-nodejs-testing-exercise-tejash.git
cd grootan-nodejs-testing-exercise-tejash

# Install all dependencies
npm install
```

---

### Step 5 — Configure Environment Variables

Copy the example file and fill in your values:
```powershell
copy .env.example .env
```

> See [Section 2 — Environment Variables](#2-environment-variables) for all required values.

---

### Step 6 — Verify Setup

```powershell
# Run TypeScript type check (no errors should appear)
npx tsc --noEmit

# Run all tests
npm test

# Start in development mode (hot-reload)
npm run dev
```

Open http://localhost:3000 — you should see the TaskFlow dashboard.

---

## 2. Environment Variables

Create a `.env` file in the project root with the following:

```env
# ─── App ─────────────────────────────────────────────────────────────
NODE_ENV=development
PORT=3000

# ─── MongoDB ──────────────────────────────────────────────────────────
# Local:
MONGODB_URI=mongodb://localhost:27017/taskflow

# MongoDB Atlas (production):
# MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/taskflow?retryWrites=true&w=majority

# ─── Redis ────────────────────────────────────────────────────────────
# Local:
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Redis Cloud (production):
# REDIS_HOST=redis-xxxxx.c1.us-east-1-2.ec2.cloud.redislabs.com
# REDIS_PORT=12345
# REDIS_PASSWORD=your_redis_password

# ─── JWT / Session ───────────────────────────────────────────────────
JWT_SECRET=your_super_secret_jwt_key_min_32_chars_long
SESSION_SECRET=your_session_secret_min_32_chars

# ─── Email (Nodemailer) ───────────────────────────────────────────────
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your.email@gmail.com
EMAIL_PASS=your_gmail_app_password   # Use Gmail App Password, not your real password
EMAIL_FROM=TaskFlow <your.email@gmail.com>

# ─── Logging ─────────────────────────────────────────────────────────
LOG_LEVEL=debug   # debug | info | warn | error
```

### Gmail App Password (for email setup):
1. Go to https://myaccount.google.com/security
2. Enable **2-Step Verification**
3. Go to **App passwords** → Generate a password for "Mail"
4. Use that 16-character password as `EMAIL_PASS`

---

## 3. Running the Application

```powershell
# Development (ts-node-dev, hot-reload)
npm run dev

# Type check only (no output)
npx tsc --noEmit

# Build to JavaScript
npm run build

# Run compiled production build
npm start

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint
npm run lint

# Lint + auto-fix
npm run lint:fix
```

---

## 4. Git Branching Strategy

```
main           ← production-ready; tagged with version releases
  │
  ├── develop  ← integration branch; all features merge here first
  │     │
  │     ├── feature/phase-1-foundation
  │     ├── feature/phase-2-models
  │     ├── feature/phase-3-crud
  │     ├── feature/phase-4-ui
  │     ├── feature/phase-5-auth
  │     ├── feature/phase-6-search
  │     ├── feature/phase-7-testing
  │     └── feature/phase-8-email
  │
  └── hotfix/* ← urgent production fixes; merge to both main + develop
```

### Branch Rules (enforce in GitLab → Settings → Repository → Protected Branches):

| Branch | Who can push | Who can merge | Requires MR | CI required |
|--------|-------------|--------------|-------------|-------------|
| `main` | No one directly | Maintainers | ✅ | ✅ |
| `develop` | Developers | Developers | ✅ | ✅ |
| `feature/*` | Developer (owner) | Anyone | — | ✅ |

### Workflow:
```powershell
# 1. Start a feature
git checkout develop
git pull origin develop
git checkout -b feature/my-feature

# 2. Work, commit, push
git add -A
git commit -m "feat: add my feature"
git push origin feature/my-feature

# 3. Open MR: feature/* → develop (in GitLab UI)
# 4. After review + CI pass → merge

# 5. When develop is stable, open MR: develop → main
# 6. After merge to main, create version tag (see Section 6)
```

---

## 5. GitLab CI/CD Pipeline

The `.gitlab-ci.yml` defines a **5-stage pipeline**:

```
lint → test → build → release → deploy
```

| Stage | Job | Trigger | Purpose |
|-------|-----|---------|---------|
| lint | `lint` | all branches | ESLint + TypeScript type check |
| test | `test:unit` | all branches | Jest unit tests + coverage |
| test | `test:integration` | develop, main, tags | Jest integration with MongoDB |
| build | `build` | develop, main, tags | `npm run build` → `dist/` artifact |
| release | `release:create` | `v*.*.*` tags only | Creates GitLab Release page |
| deploy | `deploy:staging` | develop (auto) | Deploy to staging environment |
| deploy | `deploy:production` | main + tags (manual) | Deploy to production (requires approval) |

### Setting Up GitLab CI Variables:
Go to **GitLab → Your Project → Settings → CI/CD → Variables** and add:

| Variable | Value | Protected | Masked |
|----------|-------|-----------|--------|
| `MONGODB_URI` | your MongoDB Atlas URI | ✅ | ✅ |
| `REDIS_HOST` | your Redis Cloud host | ✅ | ✅ |
| `REDIS_PASSWORD` | your Redis password | ✅ | ✅ |
| `JWT_SECRET` | 32+ char secret | ✅ | ✅ |
| `SSH_PRIVATE_KEY` | PEM private key for server | ✅ | ✅ |
| `STAGING_SERVER` | staging server IP | ✅ | — |
| `PRODUCTION_SERVER` | production server IP | ✅ | — |

---

## 6. Version Tags (Phase Releases)

### Tagging Strategy

Each phase of development gets a semantic version tag:

| Tag | Phase | Description |
|-----|-------|-------------|
| `v0.1.0` | Phase 1 | Project Foundation |
| `v0.2.0` | Phase 2 | Data Models |
| `v0.3.0` | Phase 3 | CRUD Operations |
| `v0.4.0` | Phase 4 | UI & Views |
| `v0.5.0` | Phase 5 | Authentication |
| `v0.6.0` | Phase 6 | Search & Filters |
| `v0.7.0` | Phase 7 | Testing (139 tests) |
| `v0.8.0` | Phase 8 | Email & Notifications |
| `v1.0.0` | Phase 9 | Production Ready |

### Creating Tags:

```powershell
# Tag the current HEAD (latest work)
git tag -a v1.0.0 -m "Phase 9: Production Ready — logging, dark mode, CI/CD, deployment configs"

# Or tag a specific past commit
git log --oneline   # find the commit SHA
git tag -a v0.7.0 <commit-sha> -m "Phase 7: Testing complete — 139 tests passing"

# Push all tags to GitLab
git push origin --tags

# Push all tags to GitHub
git push github --tags
```

### Triggering a Release:
When you push a tag matching `v*.*.*` to GitLab, the pipeline automatically:
1. Runs all CI stages
2. Creates a **GitLab Release** with the tag name
3. Attaches the `dist/` build artifact
4. Triggers the **production deploy** (manual approval required)

---

## 7. Deploying to Vercel

> ⚠️ **Important Limitation:** TaskFlow uses **Socket.io** (WebSockets) and **BullMQ** (Redis background jobs). Vercel is a **serverless** platform — it does **not** support persistent WebSocket connections or background workers natively.
>
> **Recommendation:** Use [Railway](#9-recommended-cloud-platform-railway) or [Render](https://render.com) for full functionality. Use Vercel only if you remove Socket.io.

### Deploying to Vercel (API-only mode, without sockets):

**Step 1 — Install Vercel CLI:**
```powershell
npm install -g vercel
```

**Step 2 — Login:**
```powershell
vercel login
```

**Step 3 — Build the project:**
```powershell
npm run build
```

**Step 4 — Deploy:**
```powershell
vercel --prod
```
Vercel reads `vercel.json` automatically and deploys from `dist/server.js`.

**Step 5 — Set environment variables on Vercel:**
```powershell
vercel env add MONGODB_URI production
vercel env add JWT_SECRET production
vercel env add SESSION_SECRET production
# (add all variables from Section 2)
```

Or set them in the Vercel Dashboard → Your Project → Settings → Environment Variables.

**Step 6 — Redeploy after env vars:**
```powershell
vercel --prod
```

### Auto-Deploy via GitHub/GitLab:
- Connect your repo in the Vercel Dashboard → every push to `main` auto-deploys.

---

## 8. Deploying to VPS with PM2

For a full-featured deployment (with Socket.io + Redis):

### Prerequisites on Server:
```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs

# Install PM2 globally
npm install -g pm2

# Install Redis
sudo apt-get install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

### Deploy Steps:
```bash
# 1. Clone repo
git clone https://gitlab.grootan.com/interns-2026/grootan-nodejs-testing-exercise-tejash.git /var/www/taskflow
cd /var/www/taskflow

# 2. Install production dependencies only
npm ci --omit=dev

# 3. Create .env (fill in production values)
cp .env.example .env
nano .env

# 4. Build TypeScript
npm run build

# 5. Start with PM2 (cluster mode, one per CPU)
pm2 start ecosystem.config.js --env production

# 6. Save process list + auto-start on reboot
pm2 save
pm2 startup   # follow the printed command
```

### PM2 Common Commands:
```bash
pm2 status                        # view all running processes
pm2 logs taskflow-api             # tail logs
pm2 reload taskflow-api           # zero-downtime reload
pm2 restart taskflow-api          # full restart
pm2 stop taskflow-api             # stop
pm2 delete taskflow-api           # remove from PM2

# Deploy new version (zero-downtime):
git pull origin main && npm ci --omit=dev && npm run build && pm2 reload ecosystem.config.js --env production
```

---

## 9. Recommended Cloud Platform (Railway)

**Railway** supports Node.js apps with persistent connections, Redis, and MongoDB as managed services — perfect for TaskFlow.

### Steps:

1. Go to https://railway.app → New Project
2. Click **Deploy from GitHub repo** → select your repo
3. Railway auto-detects Node.js and runs `npm start`
4. Add services:
   - **Redis** → click "+ New" → Redis (auto-connects via `REDIS_URL`)
   - **MongoDB** → use MongoDB Atlas free tier + paste the URI
5. Set environment variables in Railway Dashboard → Variables tab
6. Railway gives you a public URL (`https://your-app.railway.app`)

### Free Tier Limits (Railway):
- 500 hours/month compute
- 1 GB memory
- Custom domains supported

---

## Quick Reference

```powershell
# Local dev startup sequence:
net start MongoDB          # start MongoDB Windows service
# (start Redis via WSL/Docker)
npm run dev                # start app at http://localhost:3000

# Check everything is healthy:
curl http://localhost:3000/health

# Run tests before pushing:
npm test

# Push with tags:
git push origin main --tags
git push github main --tags
```
