# Facial Attendance Kiosk (local)

Cloud-ready facial **time in / time out** web kiosk. **Right now everything is saved locally** on this PC in `data/attendance.json` — no Supabase or Vercel account required.

## Features

- Full-screen **kiosk** camera scan (face-api.js in the browser)
- **Admin** portal: employees, face enrollment, attendance report + CSV
- Automatic **in/out** toggle with duplicate suppression
- Local JSON database (easy to back up or migrate later)

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

1. **Admin** → Sign up (first local admin account)
2. **Employees** → Add a person → **Enroll face** (webcam)
3. **Kiosk** → enter `KIOSK_SECRET` from `.env.local` (default: `dev-kiosk-secret-change-me`)
4. Look at the camera to clock in / out

Default site URL:

`/kiosk?site=22222222-2222-2222-2222-222222222222`

## Where data lives

| What | Location |
|------|----------|
| Employees, embeddings, attendance, admins | `data/attendance.json` |
| Face ML model weights | `public/models/` |
| Secrets | `.env.local` |

Back up by copying `data/attendance.json`. Delete that file to reset to a fresh empty DB (seeded site/org recreate on next start).

## Environment

| Variable | Purpose | Default |
|----------|---------|---------|
| `KIOSK_SECRET` | Shared secret for kiosk API | `dev-kiosk-secret-change-me` |
| `SESSION_SECRET` | Signs admin login cookies | local default |
| `FACE_MATCH_THRESHOLD` | Match distance cutoff | `0.55` |
| `CLOCK_DEDUPE_SECONDS` | Ignore repeat clocks | `45` |

## Kiosk tips

- Use Chrome or Edge
- Press **F11** for fullscreen
- Keep the PC awake
- Enroll faces in similar lighting to the kiosk

## Later: cloud

The original Supabase SQL schema remains in `supabase/migrations/` for when you want multi-site cloud hosting. Local mode does not need it.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
node scripts/download-models.mjs   # re-download face models if missing
```
