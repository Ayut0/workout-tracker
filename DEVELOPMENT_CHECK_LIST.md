# ✅ Workout Journal MVP — Build Checklist

## 🧩 Planning
- [x] Define MVP scope and non-goals  
- [x] Confirm tech stack (Next.js, Prisma, Tailwind, pnpm)  
- [x] Finalize naming (`WorkoutItem`, `Set`, etc.)  
- [x] Define acceptance criteria for core flows  

---

## ⚙️ Project Setup
- [ ] Initialize repository and environment setup  
- [ ] Add linting, formatting, and testing configs  
- [ ] Configure environment variables and `.env.example`  
- [ ] Set up GitHub Actions or local CI pipeline  

---

## 🗄️ Database & ORM
- [ ] Create database schema and migrations  
- [ ] Configure Prisma and database connection  
- [ ] Seed essential data (e.g., default exercises)  
- [ ] Verify relations (User–Workout–WorkoutItem–Set)  

---

## 🧠 Domain Layer
- [ ] Define core entities and types  
- [ ] Implement domain logic (volume, e1RM)  
- [ ] Create use-case interfaces and ports  
- [ ] Ensure business rules are isolated from infrastructure  

---

## 🔌 Infrastructure Layer
- [ ] Implement repositories using Prisma  
- [ ] Configure authentication/session logic  
- [ ] Set up configuration, logging, and error handling  

---

## 🌐 API Layer
- [ ] Create API routes for workouts and progress  
- [ ] Add validation and authorization checks  
- [ ] Implement error responses and success structures  
- [ ] Test each endpoint manually and via integration tests  

---

## 🎨 UI & UX Foundation
- [ ] Build layout and navigation (dashboard, sidebar, etc.)  
- [ ] Implement global styling with Tailwind CSS  
- [ ] Add reusable UI components (Button, Input, Card)  
- [ ] Set up page routing structure  

---

## 🏋️ Workout Flow
- [ ] Build “Start Workout” page  
- [ ] Implement exercise selection and set entry  
- [ ] Handle add/remove/edit of sets  
- [ ] Save workout → redirect to history  

---

## 📅 Workout History
- [ ] Create workout list view  
- [ ] Implement detail view with exercises and sets  
- [ ] Add pagination or basic filters  
- [ ] Ensure correct user ownership checks  

---

## 📈 Progress Visualization
- [ ] Implement backend aggregation for charts  
- [ ] Create progress page (e1RM + volume)  
- [ ] Render charts with Recharts  
- [ ] Add basic date range selection  

---

## 🔁 Integration
- [ ] Wire up API calls to frontend via TanStack Query or fetch  
- [ ] Add optimistic updates where safe  
- [ ] Validate end-to-end data flow  

---

## 🧪 Testing
- [ ] Unit tests for domain logic and validation  
- [ ] Integration tests for repositories and APIs  
- [ ] E2E tests for main user flow (login → log workout → view progress)  

---

## 🔒 Security & Stability
- [ ] Verify auth and ownership per request  
- [ ] Add rate limiting on API mutations  
- [ ] Implement error tracking and logs  
- [ ] Ensure migrations and seeds are idempotent  

---

## 📚 Documentation
- [ ] Update README with setup and build instructions  
- [ ] Add API overview and schema diagram  
- [ ] Write brief deployment notes  

---

## 🚀 Deployment
- [ ] Create staging environment  
- [ ] Run migrations on deploy  
- [ ] Smoke test endpoints and UI  
- [ ] Promote to production  

---

## 🔧 Post-launch
- [ ] Collect feedback  
- [ ] Fix defects and minor UX issues  
- [ ] Plan next iteration (PR tracking, templates, CSV export)  