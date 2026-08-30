# MeritForge Assessment Portal

MeritForge is a university assessment platform for administrators, mentors, and students. It combines account administration, institution branding, timed MCQ tests, automatic scoring, leaderboards, exports, and downloadable student scorecards in one Netlify application.

## Key Features

- Hidden five-click administrator entry from the mentor login screen
- Admin-created mentor credentials with designation and WhatsApp verification
- Isolated mentor workspaces and administrator-wide result visibility
- University name and logo assignment for all or the first selected number of mentors
- Administrator announcements with optional file attachments
- Individual and CSV-based bulk MCQ creation
- Shareable test links with an eight-hour validity window
- Timed tests with automatic submission and server-side evaluation
- One submission per test for the same email or browser device
- Score-first, time-second leaderboard ranking
- CSV and PDF result exports plus print-ready visual dashboards
- Branded, downloadable student report cards without answer disclosure

## Technology

- TanStack Start and React 19
- Netlify deployment adapter and file-routed server API
- Netlify Database with Drizzle ORM
- Netlify Blobs for logos, signatures, and attachments
- jsPDF and jsPDF AutoTable for result exports
- Tailwind CSS tooling with a custom responsive CSS design system
- Lucide icons

## Run Locally

```bash
pnpm install
netlify dev --port 8889
```

Open `http://localhost:8889`. On a fresh database, open the administrator console by clicking “Administrator access” five times, then create the first mentor account.

## Data Model

The application stores mentors, login sessions, announcements, tests, questions, and attempts in Netlify Database. Uploaded media is stored in Netlify Blobs. Database migrations in `netlify/database/migrations/` are applied automatically during deployment.

## Security Notes

Mentor passwords are salted and hashed with scrypt. Mentor-owned actions require an opaque server-side session. Student-facing test data excludes correct answers, and completed reports contain scores only. The five-click administrator entry is an intentionally concealed interaction requested for this build, not a substitute for strong administrator authentication in a high-security production deployment.
