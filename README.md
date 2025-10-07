# 🏋️ Workout Journal Web App (MVP)

A clean-architecture workout tracking web app built with **TypeScript**, **Next.js**, **Prisma**, and **Tailwind CSS**.

---

## 🚀 Overview
This app lets users record their workouts and visualize their progress over time. The MVP focuses on the essential flow:

- Log workouts with exercises, sets, reps, and weights
- View past workouts
- See progress via charts (estimated 1RM and volume)

---

## 🧱 Tech Stack (WIP)
| Layer | Technology |
|-------|-------------|
| Framework | [Next.js 15 (App Router)](https://nextjs.org/) |
| Language | [TypeScript](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| Database | [PostgreSQL (prod)](https://www.postgresql.org/) / [SQLite (dev)](https://www.sqlite.org/) |
| ORM | [Prisma](https://www.prisma.io/) |
| Auth | [NextAuth.js](https://next-auth.js.org/) (email/password) |
| Charts | [Recharts](https://recharts.org/en-US/) |
| Testing | [Vitest](https://vitest.dev/), [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) |

---

## 🧩 Architecture
Following **Clean Architecture** principles:

```
UI (Next.js / React Components)
│
├─ Application (Use Cases, DTOs)
│
├─ Domain (Entities, Core Logic)
│
└─ Infrastructure (Prisma, Auth, DB, API Routes)
```

Data flows: **UI → Controller → Use Case → Repository → DB**.

---

## 🗄️ Database Schema (Simplified)
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  workouts  Workout[]
}

model Exercise {
  id          String   @id @default(cuid())
  name        String
  ownerId     String?
  owner       User?    @relation(fields: [ownerId], references: [id])
  createdAt   DateTime @default(now())
}

model Workout {
  id           String   @id @default(cuid())
  userId       String
  date         DateTime @default(now())
  notes        String?
  items        WorkoutItem[]
  user         User     @relation(fields: [userId], references: [id])
}

model WorkoutItem {
  id         String  @id @default(cuid())
  workoutId  String
  exerciseId String
  order      Int
  sets       Set[]
  workout    Workout  @relation(fields: [workoutId], references: [id])
  exercise   Exercise @relation(fields: [exerciseId], references: [id])
  @@index([workoutId])
}

model Set {
  id              String  @id @default(cuid())
  workoutItemId   String
  setIndex        Int
  reps            Int
  weight          Decimal @db.Decimal(6,2)
  workoutItem     WorkoutItem @relation(fields: [workoutItemId], references: [id])
  @@unique([workoutItemId, setIndex])
}

example relationship

Workout (2025-10-07)
  ├─ WorkoutItem: Bench Press
  │   ├─ Set 1: 10 × 60kg
  │   └─ Set 2: 8 × 65kg
  └─ WorkoutItem: Incline DB Press
      ├─ Set 1: 12 × 20kg
      └─ Set 2: 10 × 22.5kg

```

---

## 🧠 Core Features (MVP)
✅ Record workouts  
✅ View workout history  
✅ Visualize progress with charts  
✅ Manage exercise list  
✅ Change measurement units (kg/lb)

---

## 📦 Deployment
- **Vercel** for app hosting
- **Neon** or **Supabase** for managed PostgreSQL
- Migrations: `pnpm prisma migrate deploy`

---

## 🗓️ Roadmap
| Phase | Deliverable |
|--------|--------------|
| MVP | Workout CRUD, History, Progress Charts |
| v1.1 | Auth with OAuth, CSV Export |
| v1.2 | Templates, PR detection, Volume goals |

---

## 🧑‍💻 Author
Created by **Yuto** — Software Engineer.

---

## 📄 License
MIT © 2025 Yuto
