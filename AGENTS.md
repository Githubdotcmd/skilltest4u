# MeritForge Agent Guide

## Architecture

MeritForge is a TanStack Start application deployed on Netlify. The browser application and server API live in the same file-routed project.

- `src/routes/index.tsx` contains the role-based application experiences: mentor login, hidden administrator console, mentor workspace, student test runner, leaderboard, exports, and scorecard.
- `src/routes/api/app.ts` is the unified server API. It handles authentication, account administration, branding uploads, announcements, tests, question retrieval, scoring, and result queries.
- `db/schema.ts` defines the Netlify Database schema with Drizzle ORM.
- `db/index.ts` creates the Netlify Database client.
- `netlify/database/migrations/` contains deploy-applied database migrations.
- `src/styles.css` contains the complete responsive and print visual system.
- Uploaded institution logos, signatures, and announcement files are stored in the `assessment-uploads` Netlify Blobs store.

## Conventions

- Keep persistent structured records in Netlify Database and binary uploads in Netlify Blobs.
- Use snake_case database column names and camelCase TypeScript properties.
- Keep API responses free of password hashes and question answer keys.
- Require a valid mentor session for mentor-owned mutations.
- Keep student result views score-only; never return selected or correct answers after submission.
- Preserve the cream, ink, and red editorial design language and the `Italiana`/`DM Sans` typography pairing.
- Prefer focused additions to the existing role views over introducing unrelated routes.

## Important Behavior

- The administrator console opens after five clicks on the administrator text on the login screen, matching the requested interaction.
- Mentor login requires the assigned ID, password, designation, and WhatsApp number.
- Test links expire eight hours after generation or regeneration.
- Submission is rejected when the same test already has an attempt from the same normalized email or browser device identifier.
- Ranking sorts by score descending and then time ascending.
- Database migrations are required for every schema change and must be generated into `netlify/database/migrations/`.

## Local Development

Use `pnpm install`, then run `netlify dev --port 8889` so Netlify Database, Blobs, and server routes are emulated together. Do not store credentials or uploaded files in the repository.
