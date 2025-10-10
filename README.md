# 🏋️ Workout Journal Web App (MVP)

A clean-architecture workout tracking web app built with **TypeScript**, **Next.js**, **Prisma**, **Tailwind CSS**, and **Supabase**.

---

## 🚀 Overview
This app lets users record their workouts and visualize their progress over time.
The MVP focuses on the essential flow:

- Log workouts with exercises, sets, reps, and weights
- View past workouts
- See progress via charts (estimated 1RM and volume)

---

## 🧱 Tech Stack
| Layer | Technology |
|-------|-------------|
| Framework | [Next.js 15 (App Router)](https://nextjs.org/) |
| Language | [TypeScript](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| Database | [PostgreSQL (Supabase)](https://supabase.com/) |
| ORM | [Prisma](https://www.prisma.io/) |
| Auth | [Supabase Auth](https://supabase.com/auth) (email & OAuth) |
| Charts | [Recharts](https://recharts.org/en-US/) |
| Component Development | [Storybook](https://storybook.js.org/) |
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

Data flows: **UI → Controller → Use Case → Repository → DB**

---

## 🗄️ Database Schema (Simplified)

Uses **UUIDs** (compatible with Supabase `auth.users.id`) and **Row Level Security (RLS)**.  
Each user only sees their own workouts and exercises.

```prisma
model UserProfile {
  id        String   @id @default(uuid())
  userId    String   @unique
  name      String?
  createdAt DateTime @default(now())

  workouts  Workout[]
  exercises Exercise[]

  @@map("user_profiles")
}

model Exercise {
  id        String   @id @default(uuid())
  name      String
  ownerId   String?
  owner     UserProfile? @relation(fields: [ownerId], references: [id])
  isGlobal  Boolean  @default(false)
  createdAt DateTime @default(now())

  @@unique([ownerId, name])
  @@map("exercises")
}

model Workout {
  id        String   @id @default(uuid())
  userId    String
  date      DateTime @default(now())
  notes     String?
  items     WorkoutItem[]
  user      UserProfile @relation(fields: [userId], references: [id])

  @@index([userId, date])
  @@map("workouts")
}

model WorkoutItem {
  id         String  @id @default(uuid())
  workoutId  String
  exerciseId String
  order      Int
  sets       Set[]
  workout    Workout  @relation(fields: [workoutId], references: [id])
  exercise   Exercise @relation(fields: [exerciseId], references: [id])

  @@index([workoutId])
  @@map("workout_items")
}

model Set {
  id              String  @id @default(uuid())
  workoutItemId   String
  setIndex        Int
  reps            Int
  weight          Decimal @db.Decimal(7,3)
  workoutItem     WorkoutItem @relation(fields: [workoutItemId], references: [id])

  @@unique([workoutItemId, setIndex])
  @@map("sets")
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

-- Example: workouts policy
create policy "Users can manage their own workouts"
on workouts for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

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
