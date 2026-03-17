# GenSmart — Checkpoint Post Fase 7 + Hotfixes #14-#20

> **Fecha:** 2026-03-01
> **Proyecto:** `/Users/gtproot/Projects/GenSmart/`
> **Conversación anterior:** Testing E2E Fase 7 (Calendario) + Hotfixes
> **Próximo paso:** Fase 8 — Billing con Stripe

---

## 1. Estado General del Proyecto

### Fases completadas:
| Fase | Estado | Notas |
|------|--------|-------|
| 0 — Fundación | ✅ Completa | Monorepo, DB, Design System |
| 1 — Auth + Multi-tenancy | ✅ Completa | Custom JWT, 2FA, org context |
| 2 — Landing Page | ✅ Completa | Hero, pricing, blog |
| 3 — Agentes AI Core | ✅ Completa | CRUD, variables, tools, templates |
| 4 — Motor de Conversación | ✅ Completa | Message buffer, variable capture, RAG, WebSocket |
| 5 — Canales (Widget Web) | ✅ Completa | Widget iframe, sessions, fire-and-forget |
| 6 — CRM + Funnel + AI Scoring | ✅ Completa | Contacts, Kanban, scoring worker |
| 7 — Calendario | ✅ Completa | CRUD, scheduling tool, monthly view, timezone handling |

### Hotfixes aplicados en esta sesión:
| Hotfix | Commit | Descripción |
|--------|--------|-------------|
| #13b | 629ca68 | Fix delete contact FK constraint — unlink conversations before delete |
| Pre-fix | (dentro de Fase 7) | Prevent 404 toast after successful contact delete — isDeletingRef |
| #14 | — | Scheduling tools not registered for LLM in preview endpoint |
| #15 | — | Calendar grid overflow (SAT/SUN cut off) + timezone handling initial |
| #16 | — | Calendar agent_id NULL, add edit calendar UI, fix getAvailableSlots (available_days string vs number) |
| #17 | 218a173 | Include current date in scheduling system prompt so LLM uses correct year (2026 not 2024) |
| #18 | 70e7472 | Fix AppointmentModal — calendar_timezone COALESCE, localDateTimeToUTC, edit mode timezone |
| #19 | 0ccf69a | Fix CalendarView/DayDetail conditional timezone spread — timeZone always present |
| #19b | f153d7d | Timezone-aware day grouping using Intl.DateTimeFormat in CalendarView + page.tsx |
| #20 | 8ffffc7 | **CRITICAL** — Fix localTimeToUTC double timezone offset using Date.UTC + Intl.DateTimeFormat.formatToParts |

---

## 2. Detalles de Fase 7 — Sistema de Calendario

### Backend:
- **calendar.service.ts** — CRUD calendars, `getAvailableSlots` (timezone-aware), `localTimeToUTC` (server-timezone-independent)
- **appointment.service.ts** — CRUD appointments with overlap validation (tstzrange), JOIN con calendars/contacts/agents, `COALESCE(cal.timezone, 'UTC') AS calendar_timezone`
- **routes/calendar.ts** — `calendarRouter` (/api/calendars) + `appointmentRouter` (/api/appointments + /available-slots)
- **reminder.worker.ts** — BullMQ repeatable job cada 5 min, detecta citas próximas, emite WebSocket event

### Scheduling Tool Integration:
- `message.worker.ts` — `check_availability` y `book_appointment` como tool calls del LLM
- `routes/agents.ts` (preview) — misma integración para preview/sandbox
- System prompt incluye fecha actual + instrucciones de scheduling cuando hay tool tipo scheduling
- Tool definitions registradas: `check_availability(date)` y `book_appointment(date, time, name, phone, service)`

### Frontend:
- **CalendarView.tsx** — Grid mensual Mon-Sun, dots de appointments, timezone-aware day grouping con `Intl.DateTimeFormat`
- **DayDetail.tsx** — Lista de appointments del día seleccionado, timezone-aware time formatting
- **AppointmentModal.tsx** — Create/edit, fetch available slots, `localDateTimeToUTC` para enviar al backend
- **SchedulingConfigurator.tsx** — Configurar calendario en tools del agente: crear/seleccionar/editar calendario
- **calendar/page.tsx** — Layout con filtros, CalendarView + DayDetail, timezone-aware filtering

### Timezone Architecture (IMPORTANTE para futuras fases):
```
1. Cada calendario tiene `timezone` (ej: "America/Bogota")
2. Available slots se generan en hora local del calendario
3. Al crear appointment: `localTimeToUTC(date, time, timezone)` convierte a UTC
   - Usa Date.UTC() + Intl.DateTimeFormat.formatToParts (NO depende de timezone del servidor)
4. BD almacena todo en UTC (timestamptz)
5. Frontend recibe `calendar_timezone` via JOIN en cada appointment
6. Frontend usa `Intl.DateTimeFormat` con `timeZone` para mostrar en hora local
7. Day grouping usa timezone-aware helpers (getDayInTimezone, getMonthInTimezone, getYearInTimezone)
```

---

## 3. Datos de Testing en BD

### Organización principal:
- **Org ID:** `198e98cd-aaa0-4aef-ad79-a3273c609baf`
- **Nombre:** Genner Puello
- **Plan:** free
- **User:** cuenta principal (login en dashboard)

### Agentes:
- **Agente de Prueba** (org principal): `066d2687-d6b1-4d1e-a5dc-0f44255cfa37`
  - Canal: web, status: published (o active)
  - Knowledge: `codigos.md` (1 chunk), PDF de 550KB (39 chunks)
  - Variables: referrer, servicio, user_name, user_email, fingerprint
  - Tools: Knowledge Base ("My knowledge base"), Scheduling ("My Scheduling")
- **Agente de Pruebas** (Starter User): `bae3fa0c-2d0c-433e-9b8e-c48845424839`

### Calendario:
- **Book Appointments:** `0e53f645-8a3e-4a67-9446-d34c52b364d8`
  - agent_id: `066d2687-d6b1-4d1e-a5dc-0f44255cfa37`
  - timezone: `America/Bogota`
  - available_days: [1,2,3,4,5,6,7] (todos los días)
  - available_hours: {"start": "09:00", "end": "17:00"}
  - slot_duration: 30, buffer_minutes: 15, max_advance_days: 30

### Appointments de testing:
- 1 appointment el jueves 5 marzo a las 4:30 PM (Colombia) — creada con el fix correcto

### Contactos relevantes:
| Nombre | Email | Score | Stage | Service | Agente |
|--------|-------|-------|-------|---------|--------|
| Vito teran | vito@yopmail.com | 7/10 | Customer | SEO | Agente de Prueba |
| Genner | genner@yopmail.com | 4/10 | Customer | unknown | Agente de Prueba |
| Genner (2do) | genner@yopmail.com | — | Lead | — | Agente de Prueba |

---

## 4. Workers Activos

```typescript
// apps/api/src/index.ts
startMessageWorker();    // message-processing queue
startRagWorker();        // rag-processing queue
startScrapingWorker();   // scraping-processing queue
startScoringWorker();    // ai-scoring queue
startReminderWorker();   // reminder worker (cada 5 min) — NUEVO Fase 7
```

---

## 5. Archivos Clave Modificados/Creados en Fase 7

### Backend (apps/api/src/):
- `services/calendar.service.ts` — **NUEVO** — CRUD calendars, getAvailableSlots, localTimeToUTC
- `services/appointment.service.ts` — **NUEVO** — CRUD appointments con JOINs
- `routes/calendar.ts` — **NUEVO** — calendarRouter + appointmentRouter
- `workers/reminder.worker.ts` — **NUEVO** — reminder job cada 5 min
- `workers/message.worker.ts` — Modificado: scheduling tool calls (check_availability, book_appointment), scheduling instructions en system prompt
- `routes/agents.ts` — Modificado: preview endpoint con scheduling tools
- `services/contact.service.ts` — Modificado: unlink conversations before delete (Hotfix #13b)
- `index.ts` — Agregado startReminderWorker()

### Frontend (apps/web/):
- `components/calendar/` — **6 archivos NUEVOS:**
  - CalendarView.tsx + CalendarView.module.css
  - DayDetail.tsx + DayDetail.module.css
  - AppointmentModal.tsx + AppointmentModal.module.css
- `app/dashboard/calendar/page.tsx` — **NUEVO** — Calendar page
- `app/dashboard/calendar/calendar.module.css` — **NUEVO**
- `app/dashboard/contacts/[id]/page.tsx` — Modificado: isDeletingRef para prevenir 404 toast
- `components/agents/ToolConfigurator.tsx` — Modificado: SchedulingConfigurator con edit calendar UI

---

## 6. Bugs Conocidos / Observaciones Menores

- **WebSocket disconnect/reconnect** frecuente en logs de consola — cosmético, no afecta funcionalidad
- **`util._extend` deprecation warning** en Next.js — es de Next.js internamente, no del proyecto
- **Contactos "Unknown"** son sesiones de widget sin variable capture — normal, no es bug
- **"+ New Appointment" button** en header principal está deshabilitado cuando no hay calendarios — correcto
- **Console.logs de debug** en calendar.service.ts (getAvailableSlots) — pueden removerse en producción

---

## 7. Convenciones del Proyecto (Recordatorio)

- **CSS Modules** (NO Tailwind) — `.module.css` junto a cada componente
- **lucide-react** para todos los iconos (NUNCA emojis)
- **Font:** Inter (Google Fonts)
- **Paleta:** Beige (#FAF8F5) + Verde WhatsApp (#25D366)
- **Auth:** Custom JWT (access en memoria, refresh httpOnly cookie)
- **API client:** `apps/web/lib/api.ts` — `api.get()`, `api.post()`, etc.
- **Validación:** Zod en backend
- **WebSocket:** socket.io — `getIO().to('org:{orgId}').emit(...)`
- **Logo:** `components/ui/Logo/Logo.tsx` — Handjet Bold 700, "Gen" negro + "Smart" verde
- **Timezone:** Siempre almacenar en UTC, convertir con Intl.DateTimeFormat para display

---

## 8. Próximos Pasos

### Fase 8 — Billing con Stripe (según dev-plan.md):
```
Backend:
- Stripe customer creation on register
- Checkout sessions (monthly/quarterly/yearly)
- Customer portal
- Webhook handler (subscription events)
- Plan enforcement middleware (check limits per plan)
- Usage tracking in Redis (messages counter) + periodic flush to usage_logs
- Trial → Free tier automatic downgrade
- BYO Key support for Enterprise (store encrypted, use user's key for LLM calls)
- Message add-on purchase (one-time Stripe charge)

Frontend: /billing → current plan, usage bars, change plan, Stripe portal, invoice history
Upgrade modal when limit reached. Banner for approaching limits.
```

### Fases restantes:
| Fase | Descripción | Días estimados |
|------|-------------|----------------|
| 8 | Billing (Stripe) | 3 |
| 9 | Notifications + Dashboard Analytics | 2 |
| 10 | i18n + GDPR | 2 |
| 11 | App Móvil (diferible) | 5 |
| 12 | MCP + Polish + Deploy | 5 |

### Features diferibles (post-MVP):
- App Móvil (Fase 11) — dashboard responsive es suficiente
- MCP integration (Fase 12.1) — feature avanzado
- Blog — lanzar sin blog (ya existe estructura básica)
- Sub-cuentas — cuentas independientes por ahora
- WhatsApp Embedded Signup — usar solo guía manual

---

## 9. Stack Técnico Actual

```
Frontend:  Next.js 16 (App Router) — Port 3000
Backend:   Express.js 5 — Port 4000
Database:  PostgreSQL 16 + pgvector
Cache:     Redis (BullMQ + contadores)
Workers:   message, rag, scraping, scoring, reminder
WebSocket: socket.io
LLM:       OpenAI (GPT-4o-mini, text-embedding-ada-002) + Anthropic (configurado)
Monorepo:  npm workspaces + Turborepo
```

---

## 10. Lecciones Aprendidas en Fase 7

1. **Timezone handling es complejo:** `new Date('...T09:00:00')` sin `Z` se interpreta como hora local del servidor. Siempre usar `Date.UTC()` para crear fechas de forma determinista.
2. **PostgreSQL puede retornar arrays como strings:** `available_days` viene como `['1','2','3']` en vez de `[1,2,3]` — siempre normalizar con `.map(Number)`.
3. **LLMs no saben la fecha actual:** Siempre inyectar la fecha y año actual en el system prompt cuando hay herramientas de scheduling.
4. **`Intl.DateTimeFormat` con `formatToParts`** es la forma más confiable de obtener componentes de fecha en una timezone específica, independiente de la timezone del servidor/browser.
5. **Frontend timezone display** debe usar `toLocaleTimeString('en-US', { timeZone: '...' })` — pero verificar que el campo timezone realmente llega desde el backend (no null).