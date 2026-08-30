# EIT Assessment Portal

EIT (Evidence in Teaching) is a responsive university assessment platform for administrators, mentors, instructors, and students. It combines account administration, institution branding, timed MCQ tests, automatic scoring, visual leaderboards, exports, and one-page PDF scorecards in one Netlify application.

## Key Features

- Concealed administrator entry after five clicks on the footer text, without a visible click counter
- Admin-created teaching accounts that match only the assigned email and password
- Optional administrator-set university name and logo that become locked in the mentor panel
- Safe temporary password reset instead of exposing stored passwords
- Administrator announcements with optional file attachments
- Manual and sample-CSV bulk MCQ creation with visible upload confirmation
- Shareable test links with an eight-hour validity window and hidden in-app role state
- Required student name, email, and WhatsApp details before test entry
- Automatic recovery of the existing scorecard for repeated email or device attempts
- Score-first, time-second visual leaderboard ranking with student selection
- CSV and branded visual PDF result exports
- One-page student scorecard with PDF preview and download
- Automatic ZIP archive download before a mentor permanently deletes a test

## Technology

- TanStack Start and React 19
- Netlify deployment adapter and unified file-routed server API
- Netlify Database with Drizzle ORM
- Netlify Blobs for logos, signatures, and attachments
- jsPDF, jsPDF AutoTable, and JSZip for PDF and archive exports
- Custom responsive CSS with the EIT cream, ink, and red editorial design system
- Lucide icons

## Run Locally

```bash
pnpm install
netlify dev --port 8889
```

Open `http://localhost:8889`. On a fresh database, click the footer text “EIT the favourite mentor, I said” five times to open the administrator console, then create the first mentor account.

## Data Model

The application stores mentors, login sessions, announcements, tests, questions, and attempts in Netlify Database. Uploaded media is stored in Netlify Blobs. Database migrations in `netlify/database/migrations/` are applied automatically during deployment.

## Security Notes

Mentor passwords are salted and hashed with scrypt. Mentor-owned actions require an opaque server-side session. Student-facing test data excludes correct answers, completed reports contain scores only, and role experiences do not use separate public route names. The five-click administrator entry remains an intentionally concealed interaction and is not a substitute for dedicated administrator authentication in a high-security production deployment.
