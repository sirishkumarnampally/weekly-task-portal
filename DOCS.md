# Weekly Task Portal — Full Documentation

> A full-stack internal task management platform for Nissan's **VPM** (Vehicle Profile Management) and **CWGW** (Carwings Gateway) teams.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Features](#4-features)
5. [User Roles & Access](#5-user-roles--access)
6. [Team Structure](#6-team-structure)
7. [Local Development Setup](#7-local-development-setup)
8. [Environment Variables](#8-environment-variables)
9. [Database Schema](#9-database-schema)
10. [API Reference](#10-api-reference)
11. [Excel Bulk Import](#11-excel-bulk-import)
12. [EC2 Deployment Guide](#12-ec2-deployment-guide)
13. [Docker Reference](#13-docker-reference)
14. [Default Credentials](#14-default-credentials)

---

## 1. Project Overview

The Weekly Task Portal allows team managers and members to:

- Log and track tasks week-by-week (Sun–Sat calendar)
- Monitor capacity, utilisation, and holiday/leave impact
- View statistics and trends per team and sub-team type
- Bulk-import users and tasks from Excel
- Export monthly dashboards to Excel

The application enforces strict **team isolation** — members only see their own team's tasks — while managers have a cross-team view.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, Tailwind CSS 3 |
| Routing | React Router v6 |
| HTTP client | Axios |
| Date logic | date-fns |
| Notifications | react-hot-toast |
| Backend | Node.js 20, Express 4 |
| Database | SQLite via better-sqlite3 |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| File upload | multer (memory storage) |
| Excel I/O | xlsx (SheetJS) |
| Containerisation | Docker + Docker Compose |
| Web server (prod) | Nginx 1.27 |

---

## 3. Project Structure

```
weekly-task-portal/
├── backend/
│   ├── data/               # SQLite database file (git-ignored)
│   ├── db/
│   │   └── database.js     # DB init, schema, migrations, seed
│   ├── middleware/
│   │   └── auth.js         # JWT authenticate + requireManager
│   ├── routes/
│   │   ├── auth.js         # Login / register
│   │   ├── tasks.js        # CRUD tasks
│   │   ├── users.js        # List / manage users
│   │   ├── capacity.js     # Capacity report + leave
│   │   ├── stats.js        # Team statistics
│   │   ├── import.js       # Excel bulk import
│   │   └── export.js       # Excel export
│   ├── server.js           # Express app entry point
│   ├── Dockerfile
│   ├── .dockerignore
│   └── .env                # Local env (not committed)
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── TaskFormModal.jsx
│   │   │   ├── TaskCard.jsx
│   │   │   ├── ConfirmDialog.jsx
│   │   │   ├── PriorityBadge.jsx
│   │   │   ├── StatusBadge.jsx
│   │   │   └── NissanTasksSlider.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── ManagerDashboard.jsx
│   │   │   ├── MemberDashboard.jsx
│   │   │   ├── CapacityReport.jsx
│   │   │   ├── ManageUsers.jsx
│   │   │   └── Stats.jsx
│   │   ├── utils/
│   │   │   └── weekUtils.js  # Week/month date helpers
│   │   └── App.jsx           # Routes + PrivateRoute
│   ├── nginx.conf            # Production Nginx config (inside container)
│   ├── Dockerfile
│   ├── .dockerignore
│   └── vite.config.js
│
├── docker-compose.yml
├── deploy.sh                 # One-shot EC2 setup script
├── .env.production.example   # Template for production env
└── DOCS.md                   # This file
```

---

## 4. Features

### Manager

| Feature | Description |
|---------|-------------|
| Task dashboard | View, filter, create, edit, delete tasks across all members and teams |
| Week selector | Switch between any Sun–Sat week |
| Capacity report | Weekly/monthly capacity per member with utilisation % |
| Leave management | Override a member's available hours or leave days per week |
| Manage users | View all members, reset passwords, delete accounts |
| Excel import | Upload a 2-sheet Excel file to replace all member accounts and tasks |
| Excel export | Download a monthly dashboard with task details per member |
| Team statistics | Bar charts and trend data per team (VPM / CWGW) and sub-type (AMO / PJ / Infra) |
| Year & week filter | Stats page scoped to any year (2024–2030), month, or specific week |

### Member

| Feature | Description |
|---------|-------------|
| Task dashboard | View own team's tasks; edit / add only own tasks |
| Week selector | Navigate any week |
| Holiday / leave | Log leave days for a week (9 h/day deducted from capacity) |

---

## 5. User Roles & Access

| Route | Manager | Member |
|-------|---------|--------|
| `/` (Manager Dashboard) | ✅ | ❌ redirect → `/member` |
| `/member` (Member Dashboard) | ❌ redirect → `/` | ✅ |
| `/capacity` | ✅ | ❌ |
| `/users` | ✅ | ❌ |
| `/stats` | ✅ | ❌ |

All protected routes require a valid JWT. Tokens expire after 7 days.

---

## 6. Team Structure

```
VPM  (Vehicle Profile Management)
  └── Sub-types: AMO · PJ · Infra

CWGW (Carwings Gateway)
  └── Sub-types: AMO · Infra
```

- Every task must be assigned one of the sub-types valid for its team.
- The `TaskFormModal` enforces this rule — the Team Type dropdown is filtered by the member's team.
- Stats are aggregated per team and per sub-type.

---

## 7. Local Development Setup

### Prerequisites

- Node.js ≥ 20
- npm ≥ 9

### 1 — Clone the repository

```bash
git clone https://github.com/sirishkumarnampally/weekly-task-portal.git
cd weekly-task-portal
```

### 2 — Backend

```bash
cd backend
cp .env.example .env          # or create manually (see §8)
npm install
node server.js                # runs on http://localhost:3001
```

### 3 — Frontend

```bash
cd frontend
npm install
npm run dev                   # runs on http://localhost:5173
```

The Vite dev server proxies all `/api/*` requests to `http://localhost:3001`, so no CORS issues during development.

### Running both with a single command

A helper script is provided at the project root:

```bash
bash start.sh
```

---

## 8. Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `5000` | Express listen port |
| `JWT_SECRET` | **Yes** | — | Secret for signing JWTs — use a long random string |
| `NODE_ENV` | No | `development` | Set to `production` on EC2 |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Comma-separated allowed origins |

**Generate a strong secret:**

```bash
openssl rand -hex 32
```

---

## 9. Database Schema

SQLite database is stored at `backend/data/tasks.db` (created automatically on first run).

### `users`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `name` | TEXT | Full name |
| `email` | TEXT UNIQUE | Login identifier |
| `role` | TEXT | `manager` or `member` |
| `team` | TEXT | `VPM` or `CWGW` |
| `password_hash` | TEXT | bcrypt hash |
| `created_at` | TEXT | ISO datetime |

### `tasks`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `user_id` | INTEGER FK | References `users(id)` — cascades delete |
| `week_start_date` | TEXT | `YYYY-MM-DD` (always a Sunday) |
| `title` | TEXT | Task name |
| `description` | TEXT | |
| `priority` | TEXT | `High` / `Medium` / `Low` |
| `status` | TEXT | `Not Started` / `In Progress` / `Completed` / `Blocked` |
| `estimated_hours` | REAL | |
| `actual_hours` | REAL | |
| `task_type` | TEXT | Free-form category |
| `requester` | TEXT | |
| `owner` | TEXT | |
| `team_type` | TEXT | `AMO` / `PJ` / `Infra` |

### `capacity`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `user_id` | INTEGER FK | Cascades delete |
| `week_start_date` | TEXT | `YYYY-MM-DD` |
| `available_hours` | REAL | Manager override (0 = use formula) |
| `leave_hours` | REAL | Member-logged leave in hours |

**Capacity formula:**  
`available = (available_hours > 0) ? available_hours : max(0, workingDays × 9 − leave_hours)`

---

## 10. API Reference

All endpoints are prefixed `/api`. Protected routes require the header:

```
Authorization: Bearer <jwt>
```

### Auth

| Method | Path | Auth | Body | Description |
|--------|------|------|------|-------------|
| POST | `/api/auth/login` | — | `{ email, password }` | Returns JWT + user |
| POST | `/api/auth/register` | — | `{ name, email, password, team }` | Registers a new member |

### Tasks

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/tasks?week=YYYY-MM-DD` | Member/Manager | List tasks (manager = all, member = own team) |
| POST | `/api/tasks` | Member/Manager | Create task |
| PUT | `/api/tasks/:id` | Owner/Manager | Update task |
| DELETE | `/api/tasks/:id` | Owner/Manager | Delete task |

### Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/users` | Manager | List all users |
| DELETE | `/api/users/:id` | Manager | Delete user (cascades tasks) |
| PUT | `/api/users/:id/password` | Manager | Reset password |

### Capacity

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/capacity/report?week=&month=` | Manager | Full capacity report |
| PUT | `/api/capacity/:userId/:week` | Manager | Set available hours for member-week |
| GET | `/api/capacity/my-leave?week=YYYY-MM-DD` | Member | Get own leave for a week |
| POST | `/api/capacity/leave` | Member | Save leave `{ week_start_date, leave_days }` |

### Statistics

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/stats?week=&month=&team=` | Manager | Task counts & trends per team/sub-type |

### Import

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/import/template` | Manager | Download Excel template |
| POST | `/api/import/preview` | Manager | Parse Excel, return preview (no DB changes) |
| POST | `/api/import/execute` | Manager | Destructive import — replaces all members & their tasks |

### Export

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/export/monthly?month=YYYY-MM&team=` | Manager | Download monthly Excel dashboard |

---

## 11. Excel Bulk Import

The manager can upload a 2-sheet Excel file to reset all member accounts and tasks.

### Sheet 1: `Users`

| Column | Required | Values |
|--------|----------|--------|
| `name` | ✅ | Full name |
| `email` | ✅ | Unique login email |
| `team` | ✅ | `VPM` or `CWGW` |
| `password` | ✅ | Plain text — hashed on import |

### Sheet 2: `Tasks`

| Column | Required | Values |
|--------|----------|--------|
| `email` | ✅ | Must match a user in Sheet 1 |
| `week_start_date` | ✅ | `YYYY-MM-DD` (Sunday) |
| `title` | ✅ | |
| `status` | ✅ | `Not Started` / `In Progress` / `Completed` / `Blocked` |
| `priority` | No | `High` / `Medium` / `Low` |
| `estimated_hours` | No | Number |
| `actual_hours` | No | Number |
| `task_type` | No | |
| `requester` | No | |
| `owner` | No | |
| `team_type` | No | `AMO` / `PJ` / `Infra` |
| `description` | No | |

### Import flow

1. **Upload** — Manager selects the file; a preview modal shows parsed users, tasks, and any errors.
2. **Review** — Manager inspects counts and validates the data before committing.
3. **Confirm** — Clicking the red **Confirm Import** button:
   - Deletes all existing member tasks
   - Deletes all existing member capacity records
   - Deletes all existing member accounts
   - Inserts new users and tasks from the Excel file

> **Warning:** The import is destructive and cannot be undone. Download a backup export first.

Download the template from **Manage Users → Download Template**.

---

## 12. EC2 Deployment Guide

The application ships as two Docker containers:

| Container | Image | Port |
|-----------|-------|------|
| `wtp-backend` | Node 20 Alpine | Internal 3001 |
| `wtp-frontend` | Nginx 1.27 Alpine (serves React + proxies `/api`) | **80 → public** |

SQLite data is persisted in a named Docker volume (`wtp_db_data`) so it survives container restarts and re-deploys.

---

### Step 1 — Launch EC2 Instance

1. Go to **EC2 → Launch Instance** in the AWS Console.
2. Choose **Amazon Linux 2023** or **Ubuntu 22.04 LTS** (t3.small or larger recommended).
3. Add a **Key Pair** so you can SSH in.
4. Under **Network Settings → Security Group**, add these inbound rules:

| Type | Protocol | Port | Source |
|------|----------|------|--------|
| SSH | TCP | 22 | Your IP |
| HTTP | TCP | **80** | 0.0.0.0/0 |

5. Launch and note the **Public IPv4 address**.

---

### Step 2 — SSH into the Instance

```bash
ssh -i your-key.pem ec2-user@<EC2_PUBLIC_IP>
# Ubuntu: ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
```

---

### Step 3 — Run the Deploy Script

The `deploy.sh` script installs Docker, clones the repo, generates a `.env` file with a random JWT secret and your public IP, then builds and starts the containers.

```bash
curl -fsSL https://raw.githubusercontent.com/sirishkumarnampally/weekly-task-portal/develop/deploy.sh -o deploy.sh
chmod +x deploy.sh
./deploy.sh
```

On first run (Amazon Linux 2023), Docker is installed and you are asked to log out and back in. Simply re-run the script after logging back in.

---

### Step 4 — Manual Setup (Alternative)

If you prefer to set up manually:

```bash
# Install Docker (Amazon Linux 2023)
sudo yum update -y && sudo yum install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
newgrp docker

# Clone repo
git clone https://github.com/sirishkumarnampally/weekly-task-portal.git
cd weekly-task-portal

# Create environment file
cp .env.production.example .env
nano .env   # fill in JWT_SECRET and CORS_ORIGIN
```

Edit `.env`:

```env
JWT_SECRET=<output of: openssl rand -hex 32>
CORS_ORIGIN=http://<EC2_PUBLIC_IP>
```

```bash
# Build and start
docker compose up --build -d
```

---

### Step 5 — Verify Deployment

```bash
# Check containers are running
docker compose ps

# Stream logs
docker compose logs -f

# Test API health
curl http://localhost:3001/api/health
```

Open `http://<EC2_PUBLIC_IP>` in a browser — you should see the login page.

---

### Step 6 — Updates / Re-deploy

```bash
cd ~/weekly-task-portal
git pull
docker compose up --build -d
```

Docker rebuilds only layers that changed, so subsequent deploys are fast.

---

### Adding HTTPS (Optional — recommended for production)

Install Certbot and use Nginx on the host as a TLS-terminating reverse proxy in front of the Docker container.

```bash
# Ubuntu
sudo apt install -y nginx certbot python3-certbot-nginx

# Point your domain A record to the EC2 IP, then:
sudo certbot --nginx -d yourdomain.com
```

Update `CORS_ORIGIN` in `.env` to `https://yourdomain.com` and restart:

```bash
docker compose up -d backend
```

---

## 13. Docker Reference

### Useful Commands

```bash
# Start in background
docker compose up -d

# Rebuild images (after code changes)
docker compose up --build -d

# Stop all containers
docker compose down

# Stop and wipe the DB volume (destructive!)
docker compose down -v

# Stream logs from both containers
docker compose logs -f

# Logs from one container only
docker compose logs -f backend
docker compose logs -f frontend

# Open a shell in the backend container
docker exec -it wtp-backend sh

# Inspect the SQLite database
docker exec -it wtp-backend sh -c "sqlite3 data/tasks.db '.tables'"
```

### Data Persistence

The SQLite file is stored in the `wtp_db_data` Docker named volume, mounted at `/app/data` inside the backend container. It survives `docker compose down` and re-deploys. Only `docker compose down -v` removes it.

To back up the database:

```bash
docker cp wtp-backend:/app/data/tasks.db ./tasks_backup_$(date +%F).db
```

To restore a backup:

```bash
docker cp ./tasks_backup_2026-05-23.db wtp-backend:/app/data/tasks.db
docker compose restart backend
```

---

## 14. Default Credentials

> **Change these immediately after first login on a production deployment.**

| Role | Email | Password |
|------|-------|----------|
| Manager | manager@demo.com | manager123 |
| Member (VPM) | bob@demo.com | member123 |
| Member (VPM) | carol@demo.com | member123 |
| Member (CWGW) | david@demo.com | member123 |
| Member (CWGW) | eva@demo.com | member123 |

Demo accounts are only seeded on a **fresh database** (when the users table is empty). They will not appear if the database already has users.

---

*Generated for Weekly Task Portal — Nissan Connected Services*
