# GenSmart — Checkpoint para Continuar en Nueva Conversación

> **Fecha:** 2026-03-02
> **Proyecto:** `/Users/gtproot/Projects/GenSmart/`
> **Última fase completada:** Fase 9 — Notifications + Dashboard Analytics
> **Próxima fase:** Fase 10 — i18n + GDPR
> **Archivos de referencia:** `spec.md` y `dev-plan.md` en la raíz del proyecto

---

## 1. Resumen Ejecutivo

GenSmart es una plataforma SaaS para crear y desplegar agentes de IA conversacionales en WhatsApp y Web. El proyecto usa monorepo (npm workspaces + Turborepo) con Next.js 16 (frontend), Express.js 5 (API), PostgreSQL 16 + pgvector, Redis + BullMQ, y Stripe para billing.

**Completamos 9 de 12 fases.** La plataforma tiene: auth completo con 2FA, landing page, agentes AI con variables inteligentes y RAG, motor de conversación con message buffer y human takeover, widget web embeddable, CRM con funnel kanban y AI scoring, calendario con scheduling tool, billing completo con Stripe, sistema de notificaciones in-app + email con triggers automáticos, y dashboard analytics con KPIs, charts y tablas.

---

## 2. Fases Completadas (0-9)

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
| 9 | Notifications + Dashboard | ✅ | Notification system (service, routes, WS real-time, email triggers), Dashboard analytics (KPIs, SVG chart, funnel overview, top agents, recent leads) |

### Total Hotfixes Aplicados: #1 — #24
El más reciente:
- #24: Fix notification.service.ts — `getOrgUsers()` referenced non-existent `is_active` column on users table. Removed the condition.

---

## 3. Orden de Fases Restantes (ACTUALIZADO)

```
Fase 10 → i18n + GDPR
Fase 12.1 → MCP Integration
Fase 5b → WhatsApp Integration (META Cloud API + Embedded Signup)
Fase 12.2-12.4 → Testing + Polish + Deploy
```

**Nota:** La App Móvil (Fase 11 original) es la ÚNICA feature diferible — el dashboard responsive la cubre. Todo lo demás (MCP, Blog, Sub-cuentas, WhatsApp Embedded Signup) es requerido para el MVP.

**Razón del orden:** WhatsApp se implementa DESPUÉS de MCP para que los agentes de WhatsApp se desplieguen con todas las herramientas disponibles (RAG, variables, scheduling, custom functions, MCP).

| Fase | Descripción | Días estimados |
|------|-------------|----------------|
| 10 | i18n + GDPR | 2 |
| 12.1 | MCP Integration | 2 |
| 5b | WhatsApp Integration | 3 |
| 12.2-12.4 | Testing + Polish + Deploy | 4 |
| **Total restante** | | **~11 días** |

---

## 4. Fase 9 — Lo Que Se Implementó (Detalle)

### 9.1 Notifications System

**Backend:**
- `apps/api/src/services/notification.service.ts` — Completo:
  - `createNotification(params)` — Crea notificación para un user específico o broadcast a todos los miembros de la org (cuando userId es null). Emite WebSocket `notification:new`. Envía email si `sendEmail=true`.
  - `listNotifications(userId, orgId, { limit, offset })` — Paginación, ordenado por created_at DESC
  - `markAsRead(notificationId, userId)` — UPDATE read=true, read_at=NOW()
  - `markAllAsRead(userId, orgId)` — Marca todas como leídas, retorna count
  - `getUnreadCount(userId, orgId)` — COUNT de no leídas
  - `emitNotification()` — helper interno que emite a room `org:{orgId}`
  - `sendNotificationEmail()` — dispatcher que llama sendHighScoreLeadEmail o sendPlanLimitEmail según type

- `apps/api/src/routes/notifications.ts` — 4 endpoints con requireAuth + orgContext + Zod:
  - `GET /api/notifications` — query params: limit (default 20), offset (default 0)
  - `GET /api/notifications/unread-count`
  - `PUT /api/notifications/read-all`
  - `PUT /api/notifications/:id/read` — UUID validated

- `apps/api/src/config/email.ts` — 2 funciones nuevas:
  - `sendHighScoreLeadEmail(user, leadInfo)` — HTML template con score badge, agent name, conversation link
  - `sendPlanLimitEmail(user, limitInfo)` — HTML template con usage bar, percent, upgrade CTA

**Triggers integrados:**
- `apps/api/src/workers/scoring.worker.ts` — Después de scoring exitoso, si score >= 8: crea notificación type `high_score_lead` con sendEmail=true, broadcast a toda la org
- `apps/api/src/services/usage.service.ts` — `checkUsageThresholds()` llamada después de `incrementMessages()`:
  - Al 80%: notificación in-app `plan_usage_80` (sin email). Redis dedup key: `notif:usage80:{orgId}:{YYYY-MM}` con TTL 35 días
  - Al 100%: notificación in-app + email `plan_usage_100`. Redis dedup key: `notif:usage100:{orgId}:{YYYY-MM}`
  - Helper `getOrgPlan(orgId)` para obtener plan de la org
  - Helper `getMonthSuffix()` para key de periodo

**Frontend:**
- `apps/web/hooks/useNotifications.ts` — Hook que:
  - Fetch initial unread count + notifications list on mount
  - Escucha WebSocket `notification:new` → prepend a lista, incrementa unreadCount
  - Expone: notifications, unreadCount, isLoading, markAsRead(), markAllAsRead(), refresh()

- `apps/web/hooks/useWebSocket.ts` — Agregado `notification:new` al interface WebSocketEvents

- `apps/web/components/notifications/NotificationBell.tsx` + `.module.css`:
  - Bell icon (lucide-react) en el header
  - Badge rojo con unread count (si > 0)
  - Click toggle dropdown (NotificationList)

- `apps/web/components/notifications/NotificationList.tsx` + `.module.css`:
  - Dropdown con header "Notifications" + "Mark all as read"
  - Lista con icono por type (Star, AlertTriangle), title truncado, message, relative time
  - Fondo diferente para unread
  - Click → markAsRead + navegar según type (high_score_lead → contact detail, plan_usage → billing)
  - Empty state con bell icon
  - Backdrop invisible para cerrar

- `apps/web/app/dashboard/layout.tsx` — NotificationBell insertado en headerRight antes del userMenu

### 9.2 Dashboard Analytics

**Backend (apps/api/src/routes/dashboard.ts):**
- `GET /api/dashboard/stats` — KPIs:
  - leads.today/week/month con todayChange/weekChange/monthChange (% calculado con pctChange helper)
  - activeConversations (WHERE status='active')
  - avgLeadScore (AVG de ai_score no null, COALESCE a 0)
  - messages.used/limit/percent (Redis counter + PLAN_LIMITS)
- `GET /api/dashboard/leads-chart?period=7d|30d|90d` — Data points con gap-fill:
  - 7d/30d: agrupado por día
  - 90d: agrupado por semana (date_trunc week, aligned to Monday)
  - Rellenar fechas sin datos con count: 0
- `GET /api/dashboard/top-agents` — Top 5 agentes: name, avatar, status, conversation_count, contact_count, avg_score
- `GET /api/dashboard/funnel-overview` — Stages fijos (lead/opportunity/customer) con count + percent
- `GET /api/dashboard/recent-leads` — Contactos con ai_score >= 5, ordenados por score DESC, limit 5

**Frontend:**
- `apps/web/app/dashboard/page.tsx` — Layout completo con parallel data fetching y Skeleton loaders:
  - Row 1: StatsCards (full width)
  - Row 2: LeadsChart (2/3) + FunnelOverview (1/3)
  - Row 3: TopAgents (1/2) + RecentLeads (1/2)

- `apps/web/components/dashboard/StatsCards.tsx` + `.module.css` — 4 KPI cards:
  - Leads this month (con % change, flecha TrendingUp/TrendingDown, subtexto today/week)
  - Active Conversations
  - Avg Lead Score (/10, color-coded verde/amarillo/rojo)
  - Messages Used (ProgressBar con color por rango)

- `apps/web/components/dashboard/LeadsChart.tsx` + `.module.css`:
  - SVG puro (polyline + polygon area fill + circles data points)
  - Toggle 7d/30d/90d
  - Tooltip on hover con fecha + count
  - EmptyState si no hay datos

- `apps/web/components/dashboard/FunnelOverview.tsx` + `.module.css`:
  - 3 barras horizontales (Lead=info, Opportunity=warning, Customer=success)
  - Count + percent por stage, total al final

- `apps/web/components/dashboard/TopAgents.tsx` + `.module.css`:
  - Tabla con Avatar, name, conversations, contacts, avg score (badge color-coded)
  - Click row → navegar a agent detail

- `apps/web/components/dashboard/RecentLeads.tsx` + `.module.css`:
  - Tabla con name+service, score badge, agent name, date
  - Click row → navegar a contact detail
  - EmptyState si no hay leads con score

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
│   │   │   ├── dashboard/          # Protected dashboard (NOT using (dashboard) route group)
│   │   │   │   ├── agents/         # Agent CRUD + editor
│   │   │   │   ├── conversations/  # Chat view + takeover
│   │   │   │   ├── contacts/       # CRM contacts
│   │   │   │   ├── funnel/         # Kanban board
│   │   │   │   ├── calendar/       # Monthly calendar view
│   │   │   │   ├── billing/        # Billing + usage + invoices
│   │   │   │   ├── settings/       # General, team, security, API keys
│   │   │   │   ├── layout.tsx      # Dashboard shell (sidebar + header + NotificationBell)
│   │   │   │   ├── dashboard.module.css
│   │   │   │   └── page.tsx        # Dashboard home (analytics) — IMPLEMENTED in Fase 9
│   │   │   └── widget/[agentId]/   # Widget mini-app (iframe)
│   │   ├── components/
│   │   │   ├── ui/                 # Design system (Button, Input, Modal, Card, Badge, Table, etc.)
│   │   │   │   └── Logo/          # Logo.tsx — Handjet Bold 700, "Gen" negro + "Smart" verde
│   │   │   ├── layout/            # Footer, PublicNavbar (NO Header/Sidebar separados — están inline en dashboard/layout.tsx)
│   │   │   ├── landing/           # Hero, Features, Pricing, etc.
│   │   │   ├── agents/            # AgentCard, AgentEditor, PromptEditor, etc.
│   │   │   ├── conversations/     # ConversationList, ChatView, TakeoverBanner
│   │   │   ├── crm/              # ContactList, ContactDetail, ScoreBadge
│   │   │   ├── funnel/           # KanbanBoard, FunnelStats
│   │   │   ├── calendar/         # CalendarView, AppointmentModal
│   │   │   ├── billing/          # CurrentPlan, UsageBars, AddOnCards, PlanUpgradeModal, UpgradeBanner
│   │   │   ├── notifications/    # NotificationBell.tsx, NotificationList.tsx — IMPLEMENTED in Fase 9
│   │   │   └── dashboard/        # StatsCards, LeadsChart, FunnelOverview, TopAgents, RecentLeads — IMPLEMENTED in Fase 9
│   │   ├── contexts/             # AuthContext (user: {id, email, name, role, orgId, orgName, totpEnabled})
│   │   ├── hooks/                # useAuth, useScrollReveal, useWebSocket, useNotifications — NEW in Fase 9
│   │   └── lib/                  # api.ts (with getAccessToken export), blog.ts, constants, utils
│   │
│   └── api/                      # Express.js 5 — Port 4000
│       └── src/
│           ├── config/           # database, redis, stripe, encryption, env, websocket, email, jwt, queues
│           ├── middleware/       # auth, orgContext, planLimits, rateLimiter, errorHandler, validate, validateUUID
│           ├── routes/           # auth, agents, conversations, contacts, funnel, calendar, billing, whatsapp,
│           │                      # widget, mobile(stub), knowledge, organization, notifications, dashboard, account
│           ├── services/         # auth, agent, llm, conversation, message-buffer, variable-capture, rag, embedding,
│           │                      # scraping, ai-scoring, calendar, appointment, stripe, email, notification, usage,
│           │                      # whatsapp, custom-function, organization, sub-account, contact
│           ├── workers/          # message, rag, scraping, scoring, reminder
│           ├── db/
│           │   ├── migrations/   # 001-026 (26 total, NO new migrations in Fase 9)
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

### Workers Activos:
```typescript
startMessageWorker();    // message-processing queue — handles LLM calls, variable capture, RAG
startRagWorker();        // rag-processing queue — file chunking + embedding
startScrapingWorker();   // scraping-processing queue — web scraping → RAG
startScoringWorker();    // ai-scoring queue — lead scoring after conversations + notification trigger (score >= 8)
startReminderWorker();   // reminder worker — appointment reminders (every 5 min check)
```

### Stack Técnico:
```
Frontend:  Next.js 16 (App Router) — Port 3000
Backend:   Express.js 5 — Port 4000
Database:  PostgreSQL 16 + pgvector (26 migrations applied)
Cache:     Redis (BullMQ queues + usage counters + message buffer + session cache + notification dedup keys)
Workers:   5 active (message, rag, scraping, scoring, reminder)
WebSocket: socket.io (real-time conversations, billing events, notifications)
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
- **API client:** `apps/web/lib/api.ts` — `api.get()`, `api.post()`, `api.put()` con interceptor 401→refresh→retry. Exporta `getAccessToken()` para WebSocket auth.
- **Validación:** Zod en backend para todos los inputs
- **WebSocket:** socket.io — `getIO().to('org:{orgId}').emit(event, data)`. Events: `conversation:update`, `message:new`, `variables:update`, `contact:scored`, `takeover:status`, `usage:limit_reached`, `notification:new`
- **Logo:** `components/ui/Logo/Logo.tsx` — Handjet Bold 700, "Gen" negro + "Smart" verde
- **Timezone:** Almacenar UTC, display con Intl.DateTimeFormat
- **Stripe Webhook:** Handler inline en index.ts ANTES de express.json(), usa express.raw()
- **Dashboard layout:** Sidebar + Header están en `dashboard/layout.tsx` (NO en componentes separados). NotificationBell está en headerRight.
- **Notifications dedup:** Redis keys `notif:usage80:{orgId}:{YYYY-MM}` y `notif:usage100:{orgId}:{YYYY-MM}` con TTL 35 días
- **Charts:** SVG puro (sin librerías de charts) — ver LeadsChart.tsx como referencia
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
- **Stats post-Fase 9:** 8 conversations, 2 contacts linked

### Calendario:
- **ID:** `0e53f645-8a3e-4a67-9446-d34c52b364d8`
- **Timezone:** America/Bogota
- **Linked to:** Agente de Prueba

### Contactos (3):
| Nombre | Email | Score | Stage | Service | Created |
|--------|-------|-------|-------|---------|---------|
| Carlos | carlos@test.com | 10/10 | Customer | SEO | Mar 2, 2026 |
| Vito teran | vito@yopmail.com | 8/10 | Customer | SEO | Feb 28, 2026 |
| Genner | genner@yopmail.com | 4/10 | Customer | unknown | Feb 28, 2026 |

### Dashboard Analytics (verificado):
- Leads this month: 1 (Carlos), -50% vs last month
- Active conversations: 6
- Avg Lead Score: 7.3/10
- Messages Used: 5/5,500 (0%)
- Funnel: Lead 0, Opportunity 0, Customer 3 (100%)
- Top Agent: Agente de Prueba — 8 convos, 2 contacts, score 6.0
- Recent High-Score Leads: Carlos 10/10, Vito 8/10

---

## 8. Bugs Conocidos Pendientes

### Billing (Fase 8):
1. **Stripe Portal abre en misma ventana** — debería abrir en nueva tab o redirigir de vuelta
2. **"Renews" debería decir "Cancels"** cuando cancel_at_period_end es true en CurrentPlan
3. **Suscripciones duplicadas en Stripe** — 3 Starter extras por debugging de webhooks, canceladas para April 1
4. **Debug logs [webhook-debug] en index.ts** — remover antes de producción
5. **Change Plan crea nueva suscripción** — debería usar `stripe.subscriptions.update()` con proration

### Dashboard (Fase 9):
6. **Top Agents muestra CONTACTS: 2** cuando hay 3 contactos — posible JOIN que excluye contactos sin agent_id directo o sin score. Menor, no bloquea.
7. **Notificaciones duplicadas** — scoring worker puede disparar múltiples veces si se envían mensajes consecutivos rápidos. No es bug crítico pero considerar dedup por conversationId+type en el futuro.

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

## 11. Fase 10 — Lo Que Debe Implementarse

### 10.1 i18n (Internacionalización)
```
1. Crear archivos de traducciones:
   - apps/web/i18n/en.json — TODAS las keys del UI en inglés
   - apps/web/i18n/es.json — TODAS las keys traducidas al español

2. Hook useTranslation():
   - Detectar idioma del usuario (settings → language field en users table)
   - Fallback a idioma del browser
   - Función t('key') que retorna string traducido
   - Función t('key', { variable: value }) para interpolación

3. Traducir TODO el UI:
   - Landing page (all sections)
   - Auth pages (login, register, forgot/reset password)
   - Dashboard completo (sidebar nav, header, all pages)
   - Notifications (titles, messages)
   - Email templates
   - Error messages, empty states, tooltips

4. Language selector:
   - En Settings > General: dropdown to change language
   - En Landing Footer: selector de idioma
   - Persiste en users.language (ya existe la columna)

5. Date/number formatting:
   - Fechas en formato local (en: Mar 2, 2026; es: 2 mar 2026)
   - Números con separador correcto (en: 1,000; es: 1.000)
   - Usar Intl.DateTimeFormat y Intl.NumberFormat
```

### 10.2 GDPR (Data Management)
```
Backend:
- Worker de exportación de datos: genera ZIP con:
  - Datos de organización (JSON)
  - Contactos (CSV)
  - Conversaciones y mensajes (JSON)
  - Agentes (JSON)
  - Link de descarga expira en 7 días

- DELETE contacto: hard delete del contacto + conversaciones asociadas (resolver FK constraints — hotfix #13b pendiente)

- DELETE cuenta (30 días gracia):
  - POST /api/account/delete → marca scheduled_at = NOW() + 30 days
  - POST /api/account/delete/cancel → cancela si aún en gracia
  - POST /api/account/delete/confirm → eliminación inmediata
  - Cancelar Stripe subscription inmediatamente
  - Worker que ejecuta eliminación programada

Frontend:
- /dashboard/settings/data (nueva sub-page):
  - "Export My Data" button → triggers export worker → shows download link when ready
  - "Delete My Account" button → confirmation flow (password + reason) → 30 day countdown
  - Cancel deletion option during grace period

Migrations needed:
- Tables data_export_requests y account_deletion_requests YA EXISTEN (migraciones 022, 023)
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
9. **Column is_active no existe en users:** Claude Code asumió la existencia de esta columna al generar notification.service.ts. Siempre verificar schema real de la BD antes de asumir columnas. (Hotfix #24)
10. **Charts SVG vs librerías:** SVG puro para LeadsChart funciona bien y mantiene 0 dependencias extra. Usar como referencia para futuros charts.
11. **Notification dedup via Redis:** Keys con TTL de 35 días previenen notificaciones duplicadas de usage (80%/100%) por periodo de facturación.
12. **Dashboard no usa route group `(dashboard)`:** La carpeta es `app/dashboard/` directamente, NO `app/(dashboard)/`. Importante para routing.

---

## 13. E2E Testing Results — Fase 9

| Test | Resultado |
|------|-----------|
| Bell icon en header | ✅ |
| Notificación generada por scoring ≥ 8 | ✅ (después de hotfix #24) |
| Badge con unread count real-time | ✅ |
| Click notificación → navega al contacto | ✅ |
| Mark as read individual | ✅ |
| Mark all as read | ✅ |
| Badge desaparece al leer todo | ✅ |
| StatsCards (4 KPIs con datos reales) | ✅ |
| Leads chart 7d con datos reales + SVG | ✅ |
| Leads chart toggle 30d/90d | ✅ |
| Funnel Overview (3 stages + percentages) | ✅ |
| Top Agents tabla con avatar | ✅ |
| Recent High-Score Leads tabla | ✅ |
| Click en lead row → navega a contacto | ✅ |
| Skeleton loaders while loading | ✅ |
| Empty state cuando no hay datos | ✅ (implícito) |
| Responsive mobile view | No probado aún |

---

## 14. Prompt para Claude Code — Fase 10

```
Lee spec.md y dev-plan.md en la raíz del proyecto.
Lee también este checkpoint para contexto completo del estado actual.

Ejecuta la Fase 10 completa (i18n + GDPR).

Fase 10.1 — i18n:
- Crear apps/web/i18n/en.json y apps/web/i18n/es.json con TODAS las keys del UI
- Hook useTranslation() que detecta idioma del user (users.language column), fallback a browser
- Función t('key') con soporte de interpolación t('key', { name: 'value' })
- Traducir TODO: landing, auth, dashboard, settings, notifications, errors, empty states
- Language selector en Settings > General + Landing Footer
- Date/number formatting con Intl.DateTimeFormat y Intl.NumberFormat por locale
- Persistir preferencia en users.language (columna ya existe)

Fase 10.2 — GDPR:
- Data export worker: genera ZIP (org JSON, contacts CSV, conversations JSON, agents JSON)
- Endpoints: POST /api/account/export-data, GET /api/account/export-data/:id (download)
- Delete contact: hard delete + cascade conversations (resolver FK constraints)
- Delete account flow: POST /api/account/delete (schedule 30 day), /cancel, /confirm (immediate)
- Cancel Stripe subscription on delete
- Frontend: /dashboard/settings/data page con Export Data button + Delete Account flow
- Tables data_export_requests y account_deletion_requests YA EXISTEN (migraciones 022-023)

CSS Modules, lucide-react, paleta de colores del spec.
Git commit al final de cada sub-fase.
```