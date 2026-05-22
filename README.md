# Weekly Task Portal

A full-stack team task management web portal with role-based access for managers and team members.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Tailwind CSS + Vite |
| Backend | Node.js + Express |
| Database | SQLite (via better-sqlite3) |
| Auth | JWT (role-based) |
| Export | xlsx / CSV |

## Quick Start

```bash
# 1. Start backend (port 3001)
cd backend
npm install
npm run dev

# 2. Start frontend (port 5173) — in a new terminal
cd frontend
npm install
npm run dev
```

Or use the convenience script from the project root:

```bash
chmod +x start.sh && ./start.sh
```

Then open **http://localhost:5173**

## Demo Accounts

| Role | Email | Password |
|---|---|---|
| Manager | manager@demo.com | manager123 |
| Member | bob@demo.com | member123 |
| Member | carol@demo.com | member123 |
| Member | david@demo.com | member123 |

## Features

### Team Member
- Log in and view only your own tasks
- Add / edit / delete tasks per week
- Track: Title, Description, Priority, Status, Estimated & Actual Hours, Notes
- Week selector to navigate past weeks

### Manager
- View all team members' tasks in a sortable table
- Filter by week, team member, status, and priority
- Summary stats: total tasks, completion %, blocked count, hours
- Export to Excel (.xlsx) or CSV with date-range and member filters
- Full user management (create, edit, delete team members)

## Project Structure

```
weekly_task_portal/
├── backend/
│   ├── db/          # SQLite schema + seed data
│   ├── middleware/  # JWT auth middleware
│   ├── routes/      # auth, tasks, users, export
│   └── server.js
├── frontend/
│   └── src/
│       ├── components/   # Sidebar, TaskCard, TaskFormModal, etc.
│       ├── context/      # AuthContext (JWT)
│       ├── pages/        # Login, MemberDashboard, ManagerDashboard, ManageUsers
│       └── utils/        # weekUtils (date helpers)
└── start.sh
```

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and update as needed.

| Variable | Default | Description |
|---|---|---|
| PORT | 3001 | Backend server port |
| JWT_SECRET | — | Secret key for signing JWTs |
| NODE_ENV | development | Environment |
