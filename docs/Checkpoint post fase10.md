# GenSmart — Checkpoint para Continuar en Nueva Conversación

> **Fecha:** 2026-03-02
> **Proyecto:** `/Users/gtproot/Projects/GenSmart/`
> **Última fase completada:** Fase 10 — i18n + GDPR
> **Próxima fase:** Fase 12.1 — MCP Integration
> **Archivos de referencia:** `spec.md` y `dev-plan.md` en la raíz del proyecto

---

## 1. Resumen Ejecutivo

GenSmart es una plataforma SaaS para crear y desplegar agentes de IA conversacionales en WhatsApp y Web. El proyecto usa monorepo (npm workspaces + Turborepo) con Next.js 16 (frontend), Express.js 5 (API), PostgreSQL 16 + pgvector, Redis + BullMQ, y Stripe para billing.

**Completamos 10 de 12 fases.** La plataforma tiene: auth completo con 2FA, landing page bilingüe (EN/ES), agentes AI con variables inteligentes y RAG, motor de conversación con message buffer y human takeover, widget web embeddable, CRM con funnel kanban y AI scoring, calendario con scheduling tool, billing completo con Stripe, sistema de notificaciones in-app + email con triggers automáticos, dashboard analytics con KPIs/charts/tablas, internacionalización completa (EN/ES) en todo el UI, y funcionalidades GDPR (export data + delete account).

---

## 2. Fases Completadas (0-10)

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
| 8 | Billing (Stripe) | ✅ | Checkout sessions, Customer Portal (nueva tab), webhook processing, plan enforcement middleware, usage tracking (Redis counters), add-ons (500/2000/5000 msgs), BYO API Key (Enterprise), invoice history, subscriptions.update() con proration |
| 9 | Notifications + Dashboard | ✅ | Notification system (service, routes, WS real-time, email triggers), Dashboard analytics (KPIs, SVG chart, funnel overview, top agents, recent leads) |
| 10 | i18n + GDPR | ✅ | Bilingüe completo EN/ES (600+ keys, 50+ componentes), LanguageContext, useTranslation hook, formatters (Intl.*), data export ZIP worker, delete account (30 day grace + immediate), blog posts por idioma |

---

## 3. Hotfixes Aplicados: #1 — #32 + i18n fixes

### Hotfixes Pre-Fase 10 (#25-#32):
- **#25:** Change Plan usa `stripe.subscriptions.update()` con proration (no crea suscripción nueva). Nuevo `updateSubscriptionPlan()` en stripe.service.ts
- **#26:** "Cancels on [date]" en rojo cuando `cancel_at_period_end = true` en CurrentPlan
- **#27:** Stripe Customer Portal abre en nueva tab con `window.open(url, '_blank')`
- **#28:** Removidos 5 `console.log('[webhook-debug]')` de index.ts
- **#29:** Top Agents query JOINea contacts vía `conversations.contact_id` (no `contacts.agent_id`) — Carlos ahora contado
- **#30:** Recent Leads usa `LEFT JOIN LATERAL` para resolver agent name desde conversations cuando `contacts.agent_id` es NULL
- **#31:** `widget.ts` y `whatsapp.ts` incluyen `agent_id` en INSERT de contacts. Query retroactiva arregló Carlos (1 row)
- **#32:** `deleteContact` usa transacción: DELETE messages → NULL appointments (contact_id + conversation_id) → DELETE conversations → DELETE contact

### Fixes i18n (post-Fase 10):
- Fix navbar landing: "Precios" duplicado → corregido a "Cómo funciona" con `t('landing.nav.howItWorks')`
- Fix settings sub-pages: team, sub-accounts, security traducidos
- Fix agent editor: tabs, labels, buttons, badges, modals traducidos. `EDITOR_TABS` movido dentro del componente para usar `t()`
- Fix landing secciones: ProblemSolution, ChannelsSection, CRMPreview, BlogPreview convertidos a 'use client' con `t()`
- Fix pricing page: plan cards, toggle, feature comparison, add-ons, FAQ, discount badges traducidos
- Fix blog: `BlogContent.tsx` extraído como client component, 3 posts en español creados, filtrado por idioma activo

---

## 4. Orden de Fases Restantes

```
Fase 12.1 → MCP Integration
Fase 5b → WhatsApp Integration (META Cloud API + Embedded Signup)
Fase 12.2-12.4 → Testing + Polish + Deploy
```

**Nota:** La App Móvil (Fase 11 original) es la ÚNICA feature diferible — el dashboard responsive la cubre.

| Fase | Descripción | Días estimados |
|------|-------------|----------------|
| 12.1 | MCP Integration | 2 |
| 5b | WhatsApp Integration | 3 |
| 12.2-12.4 | Testing + Polish + Deploy | 4 |
| **Total restante** | | **~9 días** |

---

## 5. Fase 10 — Lo Que Se Implementó (Detalle)

### 10.1 i18n (Internacionalización)

**Archivos creados:**
- `apps/web/i18n/en.json` — 600+ keys de traducción en inglés, estructura jerárquica (common, nav, landing, auth, dashboard, agents, conversations, contacts, funnel, calendar, billing, settings, notifications, widget, errors, pricing)
- `apps/web/i18n/es.json` — 100% cobertura, traducciones naturales al español

**Infraestructura:**
- `apps/web/contexts/LanguageContext.tsx` — Proveedor de idioma: lee `user.language` → localStorage → `navigator.language`. `setLanguage()` persiste en backend vía `PUT /api/auth/me`
- `apps/web/hooks/useTranslation.ts` — Hook `t('key.nested', { variable: value })` con interpolación `{variable}`, fallback al inglés, fallback a la key
- `apps/web/lib/formatters.ts` — `formatDate`, `formatDateTime`, `formatTime`, `formatNumber`, `formatCurrency`, `formatPercent`, `formatRelativeTime` usando `Intl.*`
- Root layout: `LanguageProvider` wrapping `AuthProvider`
- `AuthUser` type ahora incluye `language: string`; auth service lo retorna en login/refresh/register

**Wiring completado en 50+ componentes:**
- Landing completa: Hero, Features, HowItWorks, ProblemSolution, ChannelsSection, CRMPreview, Pricing, Testimonials, FAQ, BlogPreview, Final CTA, PublicNavbar, Footer
- Auth: login, register, forgot-password, reset-password
- Dashboard: StatsCards, LeadsChart, FunnelOverview, TopAgents, RecentLeads
- Agents: list page, AgentCard, editor (todos los tabs: Prompt, Variables, Tools, Settings, Channels, Versions), PromptGenerator, modals (Publish, Rollback, Preview)
- Conversations: list, ChatView, TakeoverBanner, VariablesSidebar
- Contacts: list, ContactDetail (ContactHeader, ContactSummary, ContactNotes, ContactConversations, ContactVariables, ContactTimeline)
- Funnel: KanbanBoard, FunnelStats
- Calendar: CalendarView, AppointmentModal
- Billing: CurrentPlan, UsageBars, AddOnCards, PlanUpgradeModal, UpgradeBanner, InvoiceTable
- Settings: General (language selector), Team, Sub-accounts, Security, Data & Privacy
- Notifications: NotificationBell, NotificationList
- Pricing page: plans, toggle, features, comparison table
- Blog: BlogContent.tsx, filtrado por idioma

**Selectores de idioma:**
- Settings > General: dropdown English/Español → persiste en `users.language` vía API
- Landing Footer: botones EN/ES (activo resaltado en verde) → guarda en localStorage para visitantes no autenticados

**Backend i18n:**
- `notification.service.ts` — `getOrgUsers()` ahora fetch `language` field; `sendNotificationEmail` acepta `language` param; `EMAIL_STRINGS` bilingual map con templates EN/ES para high_score_lead y plan_usage_100

**Blog bilingüe:**
- 3 posts en inglés (existentes) + 3 posts en español (nuevos):
  - `como-desplegar-agente-whatsapp-ia.md` — Guía de despliegue WhatsApp
  - `lead-scoring-ia-crm.md` — Lead Scoring con IA explicado
  - `gensmart-vs-n8n-automatizacion.md` — Comparación GenSmart vs N8N
- Todos los posts tienen `language: "en"` o `language: "es"` en frontmatter
- `/blog` filtra posts por idioma activo del usuario
- Landing BlogPreview también filtra por idioma

### 10.2 GDPR (Data Management)

**Backend:**
- `apps/api/src/workers/export.worker.ts` — BullMQ worker queue `data-export`:
  - Recopila todos los datos de la org
  - Genera ZIP con archiver: org.json, users.json, agents.json, agent_tools.json, knowledge_files.json, contacts.csv, conversations.json, calendars.json, appointments.json, billing.json, notifications.json, README.json
  - Actualiza `data_export_requests` con status + file_path + expires_at (7 días)
  - Crea notificación "export ready" para el usuario

- `apps/api/src/config/queues.ts` — `exportQueue` registrada

- `apps/api/src/routes/account.ts` — Endpoints completos:
  - `POST /api/account/export-data` — Crea request, encola job
  - `GET /api/account/export-data/latest` — Último export de la org
  - `GET /api/account/export-data/:id` — Descarga ZIP
  - `GET /api/account/delete/status` — Estado de solicitud de eliminación
  - `POST /api/account/delete` — Schedule deletion (30 días gracia), cancela Stripe sub inmediatamente
  - `POST /api/account/delete/cancel` — Cancela solicitud pendiente
  - `POST /api/account/delete/confirm` — Eliminación inmediata con `performAccountDeletion()` en transacción completa

- `performAccountDeletion()` — Transacción que elimina en orden: messages → conversations → appointments → knowledge_chunks → knowledge_files → agent_tools → agent_versions → agents → contacts → calendars → notifications → billing_events → usage_logs → refresh_tokens → backup_codes → password_resets → data_export_requests → account_deletion_requests → sub_accounts → users → organization

- `apps/api/src/workers/reminder.worker.ts` — Agregado cleanup diario:
  - Eliminar archivos ZIP de exports expirados
  - Ejecutar eliminaciones programadas vencidas (`scheduled_at <= NOW()`)

**Frontend:**
- `apps/web/app/dashboard/settings/data/page.tsx` + `data.module.css`:
  - Sección "Export My Data": botón solicitar → polling 5s → estados queued/processing/ready/failed → download ZIP
  - Sección "Delete Account": modal con password + razón → 30 días gracia → cancel deletion → delete immediately (segundo modal con warning extra)
  - Todo traducido EN/ES

**Workers activos (6 total):**
```typescript
startMessageWorker();    // message-processing queue
startRagWorker();        // rag-processing queue
startScrapingWorker();   // scraping-processing queue
startScoringWorker();    // ai-scoring queue
startReminderWorker();   // reminders + export cleanup + scheduled deletions
startExportWorker();     // data-export queue — NEW in Fase 10
```

---

## 6. Arquitectura Actual del Proyecto

### Estructura de archivos clave:
```
gensmart/
├── apps/
│   ├── web/                          # Next.js 16 — Port 3000
│   │   ├── app/
│   │   │   ├── (public)/            # Landing, pricing, blog
│   │   │   ├── (auth)/             # Login, register, forgot/reset
│   │   │   ├── dashboard/          # Protected dashboard (NOT using (dashboard) route group)
│   │   │   │   ├── agents/         # Agent CRUD + editor
│   │   │   │   ├── conversations/  # Chat view + takeover
│   │   │   │   ├── contacts/       # CRM contacts
│   │   │   │   ├── funnel/         # Kanban board
│   │   │   │   ├── calendar/       # Monthly calendar view
│   │   │   │   ├── billing/        # Billing + usage + invoices
│   │   │   │   ├── settings/       # General, team, sub-accounts, security, data (GDPR) — NEW
│   │   │   │   ├── layout.tsx      # Dashboard shell (sidebar + header + NotificationBell)
│   │   │   │   ├── dashboard.module.css
│   │   │   │   └── page.tsx        # Dashboard home (analytics)
│   │   │   └── widget/[agentId]/   # Widget mini-app (iframe)
│   │   ├── components/
│   │   │   ├── ui/                 # Design system (Button, Input, Modal, Card, Badge, Table, etc.)
│   │   │   │   └── Logo/          # Logo.tsx — Handjet Bold 700, "Gen" negro + "Smart" verde
│   │   │   ├── layout/            # Footer (EN/ES selector), PublicNavbar (translated)
│   │   │   ├── landing/           # Hero, Features, HowItWorks, ProblemSolution, ChannelsSection,
│   │   │   │                       # CRMPreview, Pricing, Testimonials, FAQ, BlogPreview — ALL translated
│   │   │   ├── agents/            # AgentCard, AgentEditor, PromptEditor, etc. — ALL translated
│   │   │   ├── conversations/     # ConversationList, ChatView, TakeoverBanner — ALL translated
│   │   │   ├── crm/              # ContactList, ContactDetail + sub-components — ALL translated
│   │   │   ├── funnel/           # KanbanBoard, FunnelStats — ALL translated
│   │   │   ├── calendar/         # CalendarView, AppointmentModal — ALL translated
│   │   │   ├── billing/          # CurrentPlan, UsageBars, AddOnCards, etc. — ALL translated
│   │   │   ├── notifications/    # NotificationBell, NotificationList — ALL translated
│   │   │   └── dashboard/        # StatsCards, LeadsChart, FunnelOverview, TopAgents, RecentLeads — ALL translated
│   │   ├── contexts/             # AuthContext, LanguageContext — NEW
│   │   ├── hooks/                # useAuth, useScrollReveal, useWebSocket, useNotifications, useTranslation — NEW
│   │   ├── lib/                  # api.ts, blog.ts (with language filter), constants, utils, formatters.ts — NEW
│   │   ├── i18n/                 # en.json, es.json — NEW (600+ keys each)
│   │   ├── content/blog/         # 3 EN posts + 3 ES posts (with language frontmatter)
│   │   └── public/               # widget.js, images, favicon, robots.txt, sitemap.xml
│   │
│   └── api/                      # Express.js 5 — Port 4000
│       └── src/
│           ├── config/           # database, redis, stripe, encryption, env, websocket, email (bilingual), jwt, queues (+ exportQueue)
│           ├── middleware/       # auth, orgContext, planLimits, rateLimiter, errorHandler, validate, validateUUID
│           ├── routes/           # auth, agents, conversations, contacts, funnel, calendar, billing, whatsapp,
│           │                      # widget, mobile(stub), knowledge, organization, notifications, dashboard,
│           │                      # account (GDPR — export + delete) — COMPLETED
│           ├── services/         # auth, agent, llm, conversation, message-buffer, variable-capture, rag, embedding,
│           │                      # scraping, ai-scoring, calendar, appointment, stripe (+ updateSubscriptionPlan),
│           │                      # email, notification (bilingual), usage, whatsapp, custom-function, organization,
│           │                      # sub-account, contact
│           ├── workers/          # message, rag, scraping, scoring, reminder (+ cleanup/deletions), export — NEW
│           ├── db/
│           │   ├── migrations/   # 001-026 (26 total, NO new migrations in Fase 10)
│           │   ├── queries/
│           │   └── seeds/        # stripe-products.ts
│           ├── types/            # express.d.ts, speakeasy.d.ts
│           └── index.ts          # Entry point (Stripe webhook inline BEFORE express.json())
│
├── packages/shared/              # types, constants (PLAN_LIMITS, PRICING, MESSAGE_ADDONS), validators (Zod)
├── infra/                        # docker-compose.yml, nginx config
├── .env                          # All environment variables
├── spec.md                       # Full technical specification
└── dev-plan.md                   # Development plan
```

### Stack Técnico:
```
Frontend:  Next.js 16 (App Router) — Port 3000
Backend:   Express.js 5 — Port 4000
Database:  PostgreSQL 16 + pgvector (26 migrations applied)
Cache:     Redis (BullMQ queues + usage counters + message buffer + session cache + notification dedup keys)
Workers:   6 active (message, rag, scraping, scoring, reminder, export)
WebSocket: socket.io (real-time conversations, billing events, notifications)
LLM:       OpenAI (GPT-4o-mini, text-embedding-ada-002) + Anthropic (configured)
Payments:  Stripe test mode (subscriptions, add-ons, customer portal, webhooks)
i18n:      EN/ES bilingual (600+ keys, LanguageContext, useTranslation, Intl.* formatters)
Email:     Nodemailer + SMTP (bilingual templates). Production: Resend (configured later)
Monorepo:  npm workspaces + Turborepo
```

---

## 7. Convenciones Obligatorias

- **CSS Modules** (NO Tailwind) — `.module.css` junto a cada componente
- **lucide-react** para TODOS los iconos (NUNCA emojis)
- **Font:** Inter (Google Fonts)
- **Paleta:** Beige (#FAF8F5) fondo, Verde WhatsApp (#25D366) primario, ver spec.md sección 4 para todos los tokens
- **Auth:** Custom JWT — access token en memoria JS (NUNCA localStorage), refresh httpOnly cookie
- **API client:** `apps/web/lib/api.ts` — `api.get()`, `api.post()`, `api.put()`, `api.delete()` con interceptor 401→refresh→retry. Exporta `getAccessToken()` para WebSocket auth.
- **Validación:** Zod en backend para todos los inputs
- **WebSocket:** socket.io — `getIO().to('org:{orgId}').emit(event, data)`. Events: `conversation:update`, `message:new`, `variables:update`, `contact:scored`, `takeover:status`, `usage:limit_reached`, `notification:new`
- **Logo:** `components/ui/Logo/Logo.tsx` — Handjet Bold 700, "Gen" negro + "Smart" verde
- **Timezone:** Almacenar UTC, display con Intl.DateTimeFormat
- **Stripe Webhook:** Handler inline en index.ts ANTES de express.json(), usa express.raw(). NO mover a router.
- **Dashboard layout:** Sidebar + Header están en `dashboard/layout.tsx` (NO en componentes separados). NotificationBell está en headerRight.
- **Notifications dedup:** Redis keys `notif:usage80:{orgId}:{YYYY-MM}` y `notif:usage100:{orgId}:{YYYY-MM}` con TTL 35 días
- **Charts:** SVG puro (sin librerías de charts) — ver LeadsChart.tsx como referencia
- **i18n:** `useTranslation()` hook + `t('key.path')` en cada componente. `LanguageContext` provee idioma. `formatDate/formatNumber` con locale del usuario. Agregar keys a ambos JSON (en + es) cuando se crean nuevos componentes.
- **Blog posts:** Frontmatter requiere `language: "en"` o `language: "es"`. Filtrado automático por idioma activo.
- **Email templates:** Bilingual — consultar `users.language` antes de enviar
- **Git:** Commit al final de cada sub-fase

---

## 8. Datos de Testing Actuales

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

### Contactos (3):
| Nombre | Email | Score | Stage | Service | agent_id |
|--------|-------|-------|-------|---------|----------|
| Carlos | carlos@test.com | 10/10 | Customer | SEO | 066d2687... (fixed by HF-31) |
| Vito teran | vito@yopmail.com | 8/10 | Customer | SEO | 066d2687... |
| Genner | genner@yopmail.com | 4/10 | Customer | unknown | 066d2687... |

### Blog Posts (6):
- EN: whatsapp-agent-deploy, ai-lead-scoring-crm, n8n-vs-gensmart
- ES: como-desplegar-agente-whatsapp-ia, lead-scoring-ia-crm, gensmart-vs-n8n-automatizacion

---

## 9. Bugs Conocidos Pendientes

### Menores (no bloquean):
1. **Notificaciones duplicadas por scoring rápido** — edge case cuando se envían mensajes consecutivos rápidos. Considerar dedup por conversationId+type. No crítico.
2. **WebSocket disconnect/reconnect** frecuente en console — cosmético, sin impacto funcional
3. **`util._extend` deprecation** en Next.js — interno de Next.js, no accionable
4. **Contacts "Unknown"** — sesiones de widget sin variable capture, comportamiento esperado

### Billing (legacy, menor):
5. **Suscripciones duplicadas de test en Stripe** — 3 Starter extras por debugging de webhooks, ya canceladas para April 1. Limpiar en Stripe dashboard.

### Para Fase 12.3 (Polish):
6. **Responsive mobile view** — no probado exhaustivamente
7. **Blog posts sin imágenes de cover** — los posts referencian imágenes que no existen (`/images/blog/*.jpg`). Crear o usar placeholders.

---

## 10. Stripe Configuration (Test Mode)

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

### Webhook Notes:
- `stripe listen --forward-to localhost:4000/api/billing/webhook` must be running for local dev
- Webhook secret (`whsec_...`) changes each time `stripe listen` restarts — update .env
- Test card: `4242 4242 4242 4242`
- Handler is inline in `index.ts` BEFORE `express.json()` — DO NOT move to router

---

## 11. Cómo Iniciar el Proyecto

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

## 12. Lecciones Aprendidas Clave

1. **Stripe webhook raw body:** `express.json()` destruye el raw body. Handler DEBE ser inline en `index.ts` ANTES de `express.json()` con `express.raw({ type: 'application/json' })`
2. **Express 5 middleware ordering:** Estricto. `app.post('/path', middleware, handler)` antes de `app.use(express.json())` es la forma más segura
3. **Stripe CLI secret rota:** Verificar siempre que `.env` tiene el `whsec_` actual
4. **Message buffer optimiza tokens:** Agregar múltiples mensajes rápidos en una sola llamada LLM ahorra ~60% de tokens vs procesamiento individual
5. **Variable capture como tool invisible:** El LLM llama `capture_variable()` naturalmente durante la conversación — más efectivo que formularios
6. **CSS Modules > Tailwind para este proyecto:** Scoped styles, sin dependencias, control total sobre el design system
7. **PostgreSQL RLS para multi-tenancy:** Policies a nivel de row garantizan aislamiento de datos entre organizaciones
8. **Idempotencia en webhooks:** `stripe_event_id` UNIQUE + `ON CONFLICT DO NOTHING` previene procesamiento duplicado
9. **Column is_active no existe en users:** Claude Code asumió la existencia de esta columna. Siempre verificar schema real antes de asumir columnas. (Hotfix #24)
10. **Charts SVG vs librerías:** SVG puro para LeadsChart funciona bien y mantiene 0 dependencias extra.
11. **Notification dedup via Redis:** Keys con TTL de 35 días previenen notificaciones duplicadas por periodo.
12. **Dashboard no usa route group `(dashboard)`:** La carpeta es `app/dashboard/` directamente, NO `app/(dashboard)/`.
13. **Stripe subscriptions.update() para cambios de plan:** NUNCA crear nueva suscripción. Usar `subscriptions.update()` con `proration_behavior: 'create_prorations'`. (Hotfix #25)
14. **contacts.agent_id puede ser NULL:** Contactos creados antes del fix #31 podían no tener agent_id. Queries de dashboard deben JOINear vía conversations, no solo contacts.agent_id. (Hotfixes #29, #30, #31)
15. **DELETE contacts requiere transacción:** FK constraints con messages, conversations, appointments. Orden: messages → appointments (NULL) → conversations → contact. (Hotfix #32)
16. **i18n wiring es trabajo pesado:** Claude Code tiende a crear la infraestructura pero NO traduce todos los componentes. Requiere prompts de seguimiento explícitos componente por componente.
17. **Landing components necesitan 'use client':** Para usar `useTranslation()`, los componentes de landing deben ser client components. Convertir con `'use client'` al traducir.
18. **Blog posts necesitan `language` en frontmatter:** Sin este campo, `/blog` muestra todos los posts sin filtrar.
19. **Email templates bilingual:** `notification.service.ts` usa `EMAIL_STRINGS` map con templates EN/ES. Consultar `users.language` antes de enviar.
20. **Email provider producción: Resend** — elegido por simplicidad y free tier (3,000/mes). Configurar en Fase 12.4 (Deploy).

---

## 13. E2E Testing Results — Fase 10

### i18n:
| Test | Resultado |
|------|-----------|
| Settings > General → cambiar a Español | ✅ |
| Sidebar nav traducido | ✅ |
| Dashboard home (StatsCards, charts, tablas) | ✅ |
| Agent list + editor (todos los tabs) | ✅ |
| Conversations list + chat view | ✅ |
| Contacts list + detail | ✅ |
| Funnel kanban | ✅ |
| Calendar | ✅ |
| Billing (plan, usage, add-ons, invoices) | ✅ |
| Notifications dropdown | ✅ |
| Settings (general, team, security, sub-accounts, data) | ✅ |
| Landing completa en español (Footer EN/ES selector) | ✅ |
| Navbar: Funcionalidades / Cómo funciona / Precios / Blog | ✅ |
| Pricing page traducida | ✅ |
| Blog filtrado por idioma | ✅ |
| Auth pages (login, register) | ✅ |
| Cambiar a English → todo vuelve | ✅ |

### GDPR:
| Test | Resultado |
|------|-----------|
| Settings > Data & Privacy page visible | ✅ |
| Export Data button → solicita exportación | ✅ |
| Export polling (queued → processing → ready) | ✅ |
| Download ZIP con datos reales | ✅ |
| Delete Account modal (password + reason) | ✅ |
| Delete Account → scheduled 30 days | ✅ |
| Cancel Deletion | ✅ |
| Delete Immediately | ✅ |
| Stripe subscription cancelada al delete | ✅ |
| Todo traducido EN/ES | ✅ |

---

## 14. Fase 12.1 — Lo Que Debe Implementarse (MCP Integration)

```
Según spec.md y dev-plan.md:

Backend:
- mcp-client.service.ts: connect to MCP server (SSE/streamable-http), list tools, execute tool calls
- Integrar MCP tools en el message worker: cuando un agente tiene MCP tools configurados,
  incluirlos en las tool definitions enviadas al LLM
- El LLM puede llamar tools de MCP servers remotos durante conversaciones
- Timeout y error handling para MCP calls

Frontend:
- MCP configurator en /agents/[id]/tools:
  - Input: Server URL
  - "Test Connection" button → lista tools disponibles
  - Select/deselect tools individuales
  - Save configuración

Database:
- agent_tools table YA EXISTE con type='mcp' y config JSONB:
  {"server_url":"https://mcp.example.com/sse","transport":"sse","name":"my-mcp","selected_tools":["tool1","tool2"]}

Plan limits:
- Free: No MCP
- Starter: No MCP
- Pro: 3 MCP servers
- Enterprise: Unlimited MCP servers

Notas:
- MCP debe implementarse ANTES de WhatsApp para que los agentes de WhatsApp
  se desplieguen con MCP disponible
- Traducir nuevos strings a EN/ES
- CSS Modules, lucide-react
```

---

## 15. Notas para Fase 12.3 (Polish) — Pendientes Acumulados

Incluir estos items cuando se genere el prompt de Polish:
1. **Blog posts sin imágenes de cover** — crear o usar placeholders
2. **Blog filtrado por idioma en landing BlogPreview** — ya funciona, verificar
3. **Responsive mobile view** — testing exhaustivo
4. **Limpiar suscripciones de test duplicadas en Stripe**

---

## 16. Prompt para Claude Code — Fase 12.1 (MCP)

```
Lee spec.md y dev-plan.md en la raíz del proyecto.
Lee también este checkpoint para contexto completo del estado actual.

Ejecuta la Fase 12.1 completa (MCP Integration).

Backend:
- Crear mcp-client.service.ts: conectar a MCP server (SSE transport), listar tools, ejecutar tool calls
- Integrar MCP tools en message.worker.ts: si agente tiene MCP tools, incluirlos en tool definitions para LLM
- LLM puede llamar MCP tools durante conversaciones
- Timeout, error handling, retries para MCP calls
- Plan enforcement: Free/Starter no MCP, Pro max 3, Enterprise unlimited

Frontend:
- MCP configurator en /agents/[id]/tools:
  - Server URL input
  - "Test Connection" button → muestra tools disponibles del server
  - Checkbox para seleccionar/deseleccionar tools individuales
  - Save configuración
- Traducir TODOS los strings nuevos a EN/ES (agregar keys a en.json y es.json)

Database:
- agent_tools table YA EXISTE con soporte para type='mcp'
- Config JSONB: {"server_url":"...","transport":"sse","name":"...","selected_tools":["tool1","tool2"]}

CSS Modules, lucide-react, paleta de colores del spec.
Git commit al final.
```