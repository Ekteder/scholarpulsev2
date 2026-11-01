# ScholarPulse v2 🎓⚡

**ScholarPulse v2** is a high-performance, modern academic study tracking and revision management platform built with Next.js 16 (App Router), Tailwind CSS v4, shadcn UI / Base UI, Drizzle ORM, Neon Serverless PostgreSQL, and native Next.js Server Actions.

---

## 🚀 Live Production Deployment

- **Production App**: [https://scholarpulsev2.vercel.app](https://scholarpulsev2.vercel.app)
- **GitHub Repository**: [https://github.com/Ekteder/scholarpulsev2](https://github.com/Ekteder/scholarpulsev2)

---

## 🛠️ Tech Stack & Architecture

- **Framework**: Next.js 16 (App Router, Turbopack, React 19)
- **Styling & UI**: Tailwind CSS v4, shadcn/ui (Base UI engine), Lucide Icons, Recharts
- **Database & ORM**: Neon Serverless PostgreSQL with Drizzle ORM (`drizzle-orm/neon-http`)
- **Strict Server Enforcement**: All database & auth libraries protected with `'server-only'`
- **Mutations & Queries**: 100% Next.js Server Actions (`'use server'`) — zero client-side `fetch` API endpoints
- **Data Validation**: Comprehensive Zod schemas for all client-to-server payloads
- **Authentication**: Google OAuth 2.0 with cryptographic session tokens (`jose`) in HTTP-only cookies
- **Routing & Guardrails**: Next.js 16 `src/proxy.ts` (modern replacement for deprecated `middleware.ts`)
- **Theming**: Seamless dual light / dark theming powered by `next-themes`
- **PWA**: Installable progressive web app with offline fallback support

---

## 📚 Features

1. **Dashboard**: Daily KPI summary, study progress ring, 7-day study trend bar chart, and upcoming priority tasks.
2. **Study Tracker**: Full manual session logging with live start/end duration calculation, subject categorization, and recent session audit table.
3. **Pomodoro & Stopwatch Timer**: Wall-clock timestamp accuracy, phase transitions (Focus -> Short Break -> Long Break), synthesized audio chimes, background notification alerts, and floating mini-timer.
4. **HSC Revision Checklist Matrix**: 6-stage revision tracking (Class, Revision Note, Book Reading, MCQ Exam, CQ Solve, Test Paper Solving) with custom topics/chapters, subject creation, and activity logging.
5. **Academic Subjects**: Custom color-coded subjects, target hours, notes, and archive support.
6. **Schedule & Timetable**: Weekly timetable grid and task manager with priority filtering.
7. **Goals Tracker**: Daily, weekly, monthly, and subject-specific goals with progress tracking.
8. **In-depth Analytics**: Visual study trends via Recharts (daily hours, consistency graphs, weekly trends, subject distributions, timetable planned vs. actual adherence, and 52-week activity heatmap).
9. **Achievements & Streaks**: Automatic milestone awards, daily streak calculation, and badge showcase.
10. **Settings & Backup**: Profile management, timer defaults, notification toggles, full JSON backup export & restore, and account deletion.

---

## 💻 Local Development

Always use **pnpm**:

```bash
# Install dependencies
pnpm install

# Run database push (if modifying schema)
pnpm drizzle-kit push

# Start dev server
pnpm dev

# Typecheck & Build
pnpm tsc --noEmit
pnpm build
```

---

## 👨‍💻 Created By

**Ekteder Sanglap**
- Facebook: [https://www.facebook.com/ekteder.sanglap](https://www.facebook.com/ekteder.sanglap)
