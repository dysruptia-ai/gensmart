# GenSmart — Checkpoint para Continuar en Nueva Conversación

> **Fecha:** 2026-03-01
> **Proyecto:** `/Users/gtproot/Projects/GenSmart/`
> **Última fase completada:** Fase 8 — Billing con Stripe
> **Próxima fase:** Fase 9 — Notifications + Dashboard Analytics
> **Archivos de referencia:** `spec.md` y `dev-plan.md` en la raíz del proyecto

---

## 1. Resumen Ejecutivo

GenSmart es una plataforma SaaS para crear y desplegar agentes de IA conversacionales en WhatsApp y Web. El proyecto usa monorepo (npm workspaces + Turborepo) con Next.js 16 (frontend), Express.js 5 (API), PostgreSQL 16 + pgvector, Redis + BullMQ, y Stripe para billing.

**Completamos 8 de 12 fases.** La plataforma tiene: auth completo con 2FA, landing page, agentes AI con variables inteligentes y RAG, motor de conversación con message buffer y human takeover, widget web embeddable, CRM con funnel kanban y AI scoring, calendario con scheduling tool, y billing completo con Stripe (checkout, portal, webhooks, add-ons, plan enforcement).

---

## 2. Fases Completadas (0-8)

| Fase | Descripción | Estado | Highlights |
|------|-------------|--------|------------|
| 0 | Fundación | ✅ | Monorepo, PostgreSQL + pgvector, Design System completo |
| 1 | Auth + Multi-tenancy | ✅ | Custom JWT (access memory + refresh httpOnly), 2FA TOTP, org context, RLS |
| 2 | Landing Page | ✅ | Hero, pricing toggle (monthly/quarterly/yearly), blog SSG, SEO |
| 3 | Agentes AI Core | ✅ | CRUD, variables editor, AI prompt generator, tools (scheduling/RAG/custom), templates, avatar upload |
| 4 | Motor de Conversación | ✅ | Message buffer (Redis + BullMQ, 5s default), variable capture tool, RAG pipeline (pgvector cosine), WebSocket real-time, human takeover |
| 5 | Canales (Widget Web) | ✅ | widget.js embeddable, iframe mini-app, session persistence, fire-and-forget. **WhatsApp pendiente — se implementa después de MCP** |
| 6 | CRM + Funnel + AI Scoring | ✅ | Contact management, Kanban drag-drop (Lead→Opportunity→Customer), AI scoring worker, CSV export |
| 7 | Calendario | ✅ | CRUD calendars, appointments, available-slots calculation, scheduling tool integration, monthly view, timezone handling (America/Bogota) |
| 8 | Billing (Stripe) | ✅ | Checkout sessions, Customer Portal, webhook processing, plan enforcement middleware, usage tracking (Redis counters), add-ons (500/2000/5000 msgs), BYO API Key (Enterprise), invoice history |

### Total Hotfixes Aplicados: #1 — #23
Los más recientes (#21-#23) fueron:
- #21: Fix RLS migration — knowledge_chunks/files use agent_id JOIN
- #22: Fix Stripe webhook raw body — handler inline in index.ts BEFORE express.json()
- #23: Fix STRIPE_WEBHOOK_SECRET truncated in .env

---

## 3. Orden de Fases Restantes (ACTUALIZADO)

```
Fase 9  → Notifications + Dashboard Analytics
Fase 10 → i18n + GDPR
Fase 12.1 → MCP Integration
Fase 5b → WhatsApp Integration (META Cloud API + Embedded Signup)
Fase 12.2-12.4 → Testing + Polish + Deploy
```

**Nota:** La App Móvil (Fase 11 original) es la ÚNICA feature diferible — el dashboard responsive la cubre. Todo lo demás (MCP, Blog, Sub-cuentas, WhatsApp Embedded Signup) es requerido para el MVP.

**Razón del orden:** WhatsApp se implementa DESPUÉS de MCP para que los agentes de WhatsApp se desplieguen con todas las herramientas disponibles (RAG, variables, scheduling, custom functions, MCP).

| Fase | Descripción | Días estimados |
|------|-------------|----------------|
| 9 | Notifications + Dashboard Analytics | 2 |
| 10 | i18n + GDPR | 2 |
| 12.1 | MCP Integration | 2 |
| 5b | WhatsApp Integration | 3 |
| 12.2-12.4 | Testing + Polish + Deploy | 4 |
| **Total restante** | | **~13 días** |

---

## 4. Fase 9 — Lo Que Debe Implementarse

### 9.1 Notifications
```
Backend:
- notification.service.ts — create, list, markAsRead, markAllAsRead, getUnreadCount
- CRUD endpoints: GET /api/notifications, PUT /api/notifications/:id/read, PUT /api/notifications/read-all, GET /api/notifications/unread-count
- WebSocket: emit 'notification:new' to org room for real-time badge update
- Triggers: lead score >= 8, takeover needed, plan usage at 80%/100%
- Email (Nodemailer): lead score >= 8, plan at 90%, plan canceled, invitation accepted

Frontend:
- NotificationBell component in Header — bell icon with unread count badge
- NotificationList dropdown — list of notifications, click to mark as read
- Mark all as read button
- Notification types with icons and appropriate colors
```

### 9.2 Dashboard Home (Analytics)
```
Backend:
- GET /api/dashboard/stats — KPIs (leads count day/week/month with % change, active conversations, avg score, messages used/limit)
- GET /api/dashboard/leads-chart — leads over time (7d/30d/90d data points)
- GET /api/dashboard/top-agents — top agents by conversation count
- GET /api/dashboard/funnel-overview — contacts per stage with conversion %

Frontend: / (dashboard home page)
- KPI cards: Leads (day/week/month con % cambio), Active Conversations, Avg Lead Score, Messages Used/Limit (progress bar)
- Charts: Leads Over Time (line chart, 7d/30d/90d toggle), Funnel Overview (horizontal bars con % conversion)
- Tables: Top Agents by Conversations, Recent High-Score Leads
```

---

## 5. Arquitectura Actual del Proyecto

### Estructura de archivos clave:
```
gensmart/
├── apps/
│   ├── web/                          # Next.js 16 — Port 3000
│   │   ├── app/
│   │   │   ├── (public)/            # Landing, pricing, blog
│   │   │   ├── (auth)/             # Login, register, forgot/reset
│   │   │   ├── (dashboard)/        # Protected dashboard
│   │   │   │   ├── agents/         # Agent CRUD + editor
│   │   │   │   ├── conversations/  # Chat view + takeover
│   │   │   │   ├── contacts/       # CRM contacts
│   │   │   │   ├── funnel/         # Kanban board
│   │   │   │   ├── calendar/       # Monthly calendar view
│   │   │   │   ├── billing/        # Billing + usage + invoices
│   │   │   │   ├── settings/       # General, team, security, API keys
│   │   │   │   └── page.tsx        # Dashboard home (TO IMPLEMENT — Fase 9)
│   │   │   └── widget/[agentId]/   # Widget mini-app (iframe)
│   │   ├── components/
│   │   │   ├── ui/                 # Design system (Button, Input, Modal, etc.)
│   │   │   ├── layout/            # Sidebar, Header, PublicNavbar, Footer
│   │   │   ├── landing/           # Hero, Features, Pricing, etc.
│   │   │   ├── agents/            # AgentCard, AgentEditor, PromptEditor, etc.
│   │   │   ├── conversations/     # ConversationList, ChatView, TakeoverBanner
│   │   │   ├── crm/              # ContactList, ContactDetail, ScoreBadge
│   │   │   ├── funnel/           # KanbanBoard, FunnelStats
│   │   │   ├── calendar/         # CalendarView, AppointmentModal
│   │   │   ├── billing/          # CurrentPlan, UsageBars, AddOnCards, PlanUpgradeModal
│   │   │   ├── notifications/    # TO IMPLEMENT — Fase 9
│   │   │   └── dashboard/        # TO IMPLEMENT — Fase 9
│   │   ├── contexts/             # AuthContext, OrgContext
│   │   ├── hooks/                # useAuth, useAgent, useConversations, useContacts, useWebSocket
│   │   └── lib/                  # api.ts, constants, utils
│   │
│   └── api/                      # Express.js 5 — Port 4000
│       └── src/
│           ├── config/           # database, redis, stripe, encryption, env, websocket
│           ├── middleware/       # auth, orgContext, planLimits, rateLimiter, errorHandler, validate
│           ├── routes/           # auth, agents, conversations, contacts, funnel, calendar, billing, widget, knowledge, organization, notifications(stub)
│           ├── services/         # auth, agent, llm, conversation, message-buffer, variable-capture, rag, embedding, scraping, ai-scoring, calendar, stripe, usage, email, notification(stub)
│           ├── workers/          # message, rag, scraping, scoring, reminder
│           ├── db/               # migrations (001-026), seeds, queries
│           └── types/
│
├── packages/shared/              # types, constants (PLAN_LIMITS), validators (Zod)
├── infra/                        # docker-compose.yml, nginx config
└── .env                          # All environment variables
```

### Workers Activos:
```typescript
startMessageWorker();    // message-processing queue — handles LLM calls, variable capture, RAG
startRagWorker();        // rag-processing queue — file chunking + embedding
startScrapingWorker();   // scraping-processing queue — web scraping → RAG
startScoringWorker();    // ai-scoring queue — lead scoring after conversations
startReminderWorker();   // reminder worker — appointment reminders (every 5 min check)
```

### Stack Técnico:
```
Frontend:  Next.js 16 (App Router) — Port 3000
Backend:   Express.js 5 — Port 4000
Database:  PostgreSQL 16 + pgvector (26 migrations applied)
Cache:     Redis (BullMQ queues + usage counters + message buffer + session cache)
Workers:   5 active (message, rag, scraping, scoring, reminder)
WebSocket: socket.io (real-time conversations, billing events)
LLM:       OpenAI (GPT-4o-mini, text-embedding-ada-002) + Anthropic (configured)
Payments:  Stripe test mode (subscriptions, add-ons, customer portal, webhooks)
Monorepo:  npm workspaces + Turborepo
```

---

## 6. Convenciones Obligatorias

- **CSS Modules** (NO Tailwind) — `.module.css` junto a cada componente
- **lucide-react** para TODOS los iconos (NUNCA emojis)
- **Font:** Inter (Google Fonts)
- **Paleta:** Beige (#FAF8F5) fondo, Verde WhatsApp (#25D366) primario, ver spec.md sección 4 para todos los tokens
- **Auth:** Custom JWT — access token en memoria JS (NUNCA localStorage), refresh httpOnly cookie
- **API client:** `apps/web/lib/api.ts` — `api.get()`, `api.post()`, etc. con interceptor 401→refresh→retry
- **Validación:** Zod en backend para todos los inputs
- **WebSocket:** socket.io — `getIO().to('org:{orgId}').emit(event, data)`
- **Logo:** `components/ui/Logo/Logo.tsx` — Handjet Bold 700, "Gen" negro + "Smart" verde
- **Timezone:** Almacenar UTC, display con Intl.DateTimeFormat
- **Stripe Webhook:** Handler inline en index.ts ANTES de express.json(), usa express.raw()
- **Git:** Commit al final de cada sub-fase

---

## 7. Datos de Testing Actuales

### Organización principal:
- **Org ID:** `198e98cd-aaa0-4aef-ad79-a3273c609baf`
- **Plan actual:** Pro ($79/mo)
- **Stripe Customer:** populated
- **Stripe Subscription:** active (Pro monthly)

### Agente principal:
- **ID:** `066d2687-d6b1-4d1e-a5dc-0f44255cfa37`
- **Nombre:** Agente de Prueba
- **Canal:** web (published)
- **Knowledge:** codigos.md (1 chunk) + PDF (39 chunks)
- **Variables:** referrer, servicio, user_name, user_email, fingerprint
- **Tools:** Knowledge Base, Scheduling

### Calendario:
- **ID:** `0e53f645-8a3e-4a67-9446-d34c52b364d8`
- **Timezone:** America/Bogota
- **Linked to:** Agente de Prueba

### Contactos (2):
| Nombre | Email | Score | Stage | Service |
|--------|-------|-------|-------|---------|
| Vito teran | vito@yopmail.com | 7/10 | Customer | SEO |
| Genner | genner@yopmail.com | 4/10 | Customer | unknown |

---

## 8. Bugs Conocidos Pendientes

### Billing (Fase 8):
1. **Stripe Portal abre en misma ventana** — debería abrir en nueva tab o redirigir de vuelta
2. **"Renews" debería decir "Cancels"** cuando cancel_at_period_end es true en CurrentPlan
3. **Suscripciones duplicadas en Stripe** — 3 Starter extras por debugging de webhooks, canceladas para April 1
4. **Debug logs [webhook-debug] en index.ts** — remover antes de producción
5. **Change Plan crea nueva suscripción** — debería usar `stripe.subscriptions.update()` con proration

### Otros:
- **WebSocket disconnect/reconnect** frecuente en console — cosmético, sin impacto funcional
- **`util._extend` deprecation** en Next.js — interno de Next.js
- **Contacts "Unknown"** — sesiones de widget sin variable capture, comportamiento esperado
- **Hotfix #13b pendiente** — foreign key constraints al eliminar contactos con conversaciones asociadas

---

## 9. Stripe Configuration (Test Mode)

### Products & Prices:
| Product | Monthly | Quarterly (10% off) | Yearly (20% off) |
|---------|---------|---------------------|-------------------|
| Starter ($29) | price_1T6Bpf...xPuX8RCC | price_1T6Bpf...JIQKaLch | price_1T6Bpg...TebIt7Kq |
| Pro ($79) | price_1T6Bph...aqhzMJWo | price_1T6Bpi...nLFKIUAn | price_1T6Bpi...klWMgHVy |
| Enterprise ($199) | price_1T6Bpj...IWtQPyYA | price_1T6Bpk...YicQs1sr | price_1T6Bpk...oiwblUTQ |

### Add-ons:
| Add-on | Price ID |
|--------|----------|
| 500 msgs ($10) | price_1T6Bpl...p9IXTsRT |
| 2000 msgs ($30) | price_1T6Bpm...wcRruzNe |
| 5000 msgs ($60) | price_1T6Bpm...Y54vUsNU |

### Webhook Important Notes:
- `stripe listen --forward-to localhost:4000/api/billing/webhook` must be running for local dev
- Webhook secret (`whsec_...`) changes each time `stripe listen` restarts — update .env
- Test card: `4242 4242 4242 4242` (any future date, any CVC)
- Handler is inline in `index.ts` BEFORE `express.json()` — DO NOT move to router

---

## 10. Cómo Iniciar el Proyecto

```bash
cd /Users/gtproot/Projects/GenSmart

# 1. Start PostgreSQL + Redis (Docker)
docker-compose up -d

# 2. Start development servers (frontend + backend + workers)
npm run dev

# 3. Start Stripe webhook listener (separate terminal)
stripe listen --forward-to localhost:4000/api/billing/webhook
# Copy whsec_... to .env as STRIPE_WEBHOOK_SECRET if changed

# Frontend: http://localhost:3000
# API: http://localhost:4000
# Login: usuario de prueba registrado en dashboard
```

---

## 11. Lecciones Aprendidas Clave

1. **Stripe webhook raw body:** `express.json()` destruye el raw body. Handler DEBE ser inline en `index.ts` ANTES de `express.json()` con `express.raw({ type: 'application/json' })`
2. **Express 5 middleware ordering:** Estricto. `app.post('/path', middleware, handler)` antes de `app.use(express.json())` es la forma más segura
3. **Stripe CLI secret rota:** Verificar siempre que `.env` tiene el `whsec_` actual
4. **Message buffer optimiza tokens:** Agregar múltiples mensajes rápidos en una sola llamada LLM ahorra ~60% de tokens vs procesamiento individual
5. **Variable capture como tool invisible:** El LLM llama `capture_variable()` naturalmente durante la conversación — más efectivo que formularios
6. **CSS Modules > Tailwind para este proyecto:** Scoped styles, sin dependencias, control total sobre el design system
7. **PostgreSQL RLS para multi-tenancy:** Policies a nivel de row garantizan aislamiento de datos entre organizaciones
8. **Idempotencia en webhooks:** `stripe_event_id` UNIQUE + `ON CONFLICT DO NOTHING` previene procesamiento duplicado

---

## 12. Prompt para Claude Code — Fase 9

```
Lee spec.md y dev-plan.md en la raíz del proyecto.
Lee también este checkpoint para contexto completo del estado actual.

Ejecuta la Fase 9 completa (Notifications + Dashboard Analytics).

Fase 9.1 — Notifications:
- notification.service.ts: create, list, markAsRead, markAllAsRead, getUnreadCount
- Routes: GET /api/notifications, PUT /api/notifications/:id/read, PUT /api/notifications/read-all, GET /api/notifications/unread-count
- WebSocket: emit 'notification:new' al room org:{orgId} cuando se crea notificación
- Triggers: integrar en scoring worker (score >= 8), message worker (takeover needed), usage service (plan 80%/100%)
- Email: Nodemailer para high score leads y plan limits
- Frontend: NotificationBell en Header (bell icon + unread count badge), NotificationList dropdown, mark as read

Fase 9.2 — Dashboard Home:
- GET /api/dashboard/stats (leads day/week/month con % cambio, active conversations, avg score, messages used/limit)
- GET /api/dashboard/leads-chart (data points para 7d/30d/90d)
- GET /api/dashboard/top-agents (top agents por conversation count)
- GET /api/dashboard/funnel-overview (contacts por stage con % conversión)
- Frontend: / (dashboard home) con KPI cards, Leads Over Time line chart, Funnel Overview bars, Top Agents table, Recent High-Score Leads table

CSS Modules, lucide-react, paleta de colores del spec.
Git commit al final de cada sub-fase.
```