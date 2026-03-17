# GenSmart — Checkpoint para Continuar en Nueva Conversacion

> **Fecha:** 2026-03-03
> **Proyecto:** `/Users/gtproot/Projects/GenSmart/`
> **Ultima fase completada:** Fase 12.1 — MCP Integration + Hotfix #33
> **Proxima fase:** Fase 5b — WhatsApp Integration (META Cloud API + Embedded Signup)
> **Archivos de referencia:** `spec.md` y `dev-plan.md` en la raiz del proyecto

---

## 1. Resumen Ejecutivo

GenSmart es una plataforma SaaS para crear y desplegar agentes de IA conversacionales en WhatsApp y Web. El proyecto usa monorepo (npm workspaces + Turborepo) con Next.js 16 (frontend), Express.js 5 (API), PostgreSQL 16 + pgvector, Redis + BullMQ, y Stripe para billing.

**Completamos 11 de 12 fases (0-10 + 12.1).** La plataforma tiene: auth completo con 2FA, landing page bilingue (EN/ES), agentes AI con variables inteligentes y RAG, motor de conversacion con message buffer y human takeover, widget web embeddable, CRM con funnel kanban y AI scoring, calendario con scheduling tool, billing completo con Stripe, sistema de notificaciones in-app + email, dashboard analytics con KPIs/charts/tablas, internacionalizacion completa (EN/ES), GDPR (export data + delete account), y **MCP Integration completa** (agentes pueden conectar a MCP servers externos y usar sus tools en conversaciones).

---

## 2. Fases Completadas (0-10 + 12.1)

| Fase | Descripcion | Estado | Highlights |
|------|-------------|--------|------------|
| 0 | Fundacion | OK | Monorepo, PostgreSQL + pgvector, Design System completo |
| 1 | Auth + Multi-tenancy | OK | Custom JWT (access memory + refresh httpOnly), 2FA TOTP, org context, RLS |
| 2 | Landing Page | OK | Hero, pricing toggle (monthly/quarterly/yearly), blog SSG, SEO |
| 3 | Agentes AI Core | OK | CRUD, variables editor, AI prompt generator, tools (scheduling/RAG/custom), templates, avatar upload |
| 4 | Motor de Conversacion | OK | Message buffer (Redis + BullMQ, 5s default), variable capture tool, RAG pipeline (pgvector cosine), WebSocket real-time, human takeover |
| 5 | Canales (Widget Web) | OK | widget.js embeddable, iframe mini-app, session persistence, fire-and-forget. **WhatsApp pendiente — Fase 5b** |
| 6 | CRM + Funnel + AI Scoring | OK | Contact management, Kanban drag-drop (Lead, Opportunity, Customer), AI scoring worker, CSV export |
| 7 | Calendario | OK | CRUD calendars, appointments, available-slots calculation, scheduling tool integration, monthly view, timezone handling (America/Bogota) |
| 8 | Billing (Stripe) | OK | Checkout sessions, Customer Portal, webhook processing, plan enforcement, usage tracking (Redis counters), add-ons, BYO API Key (Enterprise), invoice history, subscriptions.update() con proration |
| 9 | Notifications + Dashboard | OK | Notification system (service, routes, WS real-time, email triggers), Dashboard analytics (KPIs, SVG chart, funnel overview, top agents, recent leads) |
| 10 | i18n + GDPR | OK | Bilingue completo EN/ES (600+ keys, 50+ componentes), LanguageContext, useTranslation hook, formatters (Intl.*), data export ZIP worker, delete account (30 day grace + immediate), blog posts por idioma |
| 12.1 | MCP Integration | OK | MCP client service (SSE transport), message worker integration con Redis cache, MCPConfigurator frontend, plan enforcement (Pro: 3, Enterprise: unlimited), test connection, preview/sandbox con MCP tools, i18n completo |

---

## 3. Hotfixes Aplicados: #1 — #33

### Hotfixes Pre-Fase 10 (#25-#32):
- **#25:** Change Plan usa `stripe.subscriptions.update()` con proration (no crea suscripcion nueva)
- **#26:** "Cancels on [date]" en rojo cuando `cancel_at_period_end = true`
- **#27:** Stripe Customer Portal abre en nueva tab con `window.open(url, '_blank')`
- **#28:** Removidos 5 `console.log('[webhook-debug]')` de index.ts
- **#29:** Top Agents query JOINea contacts via `conversations.contact_id` (no `contacts.agent_id`)
- **#30:** Recent Leads usa `LEFT JOIN LATERAL` para resolver agent name desde conversations
- **#31:** `widget.ts` y `whatsapp.ts` incluyen `agent_id` en INSERT de contacts
- **#32:** `deleteContact` usa transaccion: DELETE messages, NULL appointments, DELETE conversations, DELETE contact

### Fixes i18n (post-Fase 10):
- Fix navbar landing: "Precios" duplicado corregido
- Fix settings sub-pages: team, sub-accounts, security traducidos
- Fix agent editor: tabs, labels, buttons, badges, modals traducidos
- Fix landing secciones: ProblemSolution, ChannelsSection, CRMPreview, BlogPreview convertidos a 'use client'
- Fix pricing page: plan cards, toggle, feature comparison, add-ons, FAQ traducidos
- Fix blog: BlogContent.tsx, 3 posts en espanol creados, filtrado por idioma

### Hotfix #33 (post-Fase 12.1):
- **Bug 1 — Edit MCP Tool:** MCPConfigurator no mostraba selected_tools al editar. Fix: introdujo `isEditMode` flag, `displayTools` usa availableTools (live test) o sintetiza items desde config.selected_tools. Muestra banner "N tools saved. Click Test Connection to refresh the list."
- **Bug 2 — Add Tool Modal i18n:** ToolConfigurator no tenia i18n. Fix: TOOL_CATALOG ahora usa labelKey/descKey, todos los strings del modal traducidos (titulo, TOOL TYPE header, Tool Name, Description, Cancel, Add Tool, Save Changes, plan badges). 20+ nuevas keys en en.json + es.json (agents.tools.modal.* y agents.tools.types.*)

---

## 4. Orden de Fases Restantes

```
Fase 5b  -> WhatsApp Integration (META Cloud API + Embedded Signup) [PROXIMA]
Fase 12.2-12.4 -> Testing + Polish + Deploy
```

**Nota:** La App Movil (Fase 11 original) se diferio — el dashboard responsive la cubre.

| Fase | Descripcion | Dias estimados |
|------|-------------|----------------|
| 5b | WhatsApp Integration | 3 |
| 12.2-12.4 | Testing + Polish + Deploy | 4 |
| **Total restante** | | **~7 dias** |

---

## 5. Fase 12.1 — Lo Que Se Implemento (MCP Integration)

### Backend:

**apps/api/src/services/mcp-client.service.ts (NUEVO):**
- `connectAndListTools(serverUrl)` — Abre conexion SSE al MCP server, envía initialize (JSON-RPC), recibe initialized, envia tools/list, retorna MCPToolInfo[] (name, description, inputSchema)
- `executeMCPTool(serverUrl, toolName, arguments)` — Abre sesion SSE, envia tools/call, retorna MCPToolResult (content, isError)
- `sanitizeName(name)` — Sanitiza strings para formato de tool name LLM ([a-zA-Z0-9_])
- Usa modulos http/https nativos para SSE + JSON-RPC POSTs
- Stateless: open, use, close por cada operacion (no conexiones persistentes)
- Timeouts: 15s conexion, 30s request
- Logging con prefijo [MCP]

**apps/api/src/workers/message.worker.ts (MODIFICADO):**
- Carga MCP tools habilitados del agente: `agent_tools WHERE type='mcp' AND is_enabled=true`
- Cache Redis: key `mcp:tools:{toolId}`, TTL 1 hora. Busca en cache antes de conectar al MCP server
- Construye nombres prefijados: `mcp_{sanitizedServerName}_{toolName}`, los agrega al array llmTools
- Mantiene `mcpToolMap` para reverse-lookup cuando el LLM invoca una tool mcp_*
- En el loop de tool calls (max 5 iteraciones): detecta tools con prefijo mcp_, busca en mcpToolMap, ejecuta via mcp-client.service, retorna resultado como tool_result al LLM
- Degradacion graceful: si un MCP server falla, logea error pero continua con las demas tools

**apps/api/src/routes/agents.ts (MODIFICADO):**
- `POST /api/agents/:id/tools/mcp/test-connection` — Valida URL (HTTPS requerido, localhost permitido en dev), llama connectAndListTools, retorna {success, tools}
- `PUT /:id/tools/:toolId` — Invalida cache Redis `mcp:tools:{toolId}` al actualizar
- `DELETE /:id/tools/:toolId` — Invalida cache antes de eliminar
- Plan enforcement: Free/Starter bloqueados (403), Pro max 3 MCP tools totales en la org, Enterprise ilimitado

**packages/shared/src/constants.ts (MODIFICADO):**
- `PLAN_LIMITS` ahora incluye `mcp_servers`: free=0, starter=0, pro=3, enterprise=-1 (unlimited)

### Frontend:

**apps/web/components/agents/MCPConfigurator/ (NUEVO):**
- Server URL input + boton "Test Connection" (Spinner mientras testea)
- Exito: muestra conteo de tools + lista de checkboxes con Select All / Deselect All
- URL-changed guard: deshabilita Save y muestra warning si URL cambia despues de test exitoso
- Edit mode: muestra tools guardadas sin necesidad de reconexion, banner "N tools saved. Click Test Connection to refresh."
- onChange callback actualiza server_url, name, transport, selected_tools en parent form

**apps/web/components/agents/ToolConfigurator/ (MODIFICADO):**
- Agregado `mcpSelectedTools: string[]` a ToolForm
- `buildConfig` para mcp emite {server_url, name, transport, selected_tools} (snake_case)
- `openEdit` restaura mcpSelectedTools y config keys (con camelCase fallback)
- `renderMcpPanel()` reemplazado con componente `<MCPConfigurator />`
- i18n completo: TOOL_CATALOG usa labelKey/descKey, todos los strings del modal traducidos

### i18n:
- `agents.tools.mcp.*` — 44 keys en en.json y es.json (con interpolaciones {count}, {error}, {current}, {max})
- `agents.tools.modal.*` — 12 keys (titulo modal, labels, botones, tooltips)
- `agents.tools.types.*` — 8 keys (4 tool types x label + description)
- `agents.tools.addFirstBtn`, `agents.tools.noToolsDesc`

---

## 6. Arquitectura Actual del Proyecto

### Estructura de archivos clave:
```
gensmart/
+-- apps/
|   +-- web/                          # Next.js 16 -- Port 3000
|   |   +-- app/
|   |   |   +-- (public)/            # Landing, pricing, blog
|   |   |   +-- (auth)/             # Login, register, forgot/reset
|   |   |   +-- dashboard/          # Protected dashboard (NOT using (dashboard) route group)
|   |   |   |   +-- agents/         # Agent CRUD + editor
|   |   |   |   +-- conversations/  # Chat view + takeover
|   |   |   |   +-- contacts/       # CRM contacts
|   |   |   |   +-- funnel/         # Kanban board
|   |   |   |   +-- calendar/       # Monthly calendar view
|   |   |   |   +-- billing/        # Billing + usage + invoices
|   |   |   |   +-- settings/       # General, team, sub-accounts, security, data (GDPR)
|   |   |   |   +-- layout.tsx      # Dashboard shell (sidebar + header + NotificationBell)
|   |   |   |   +-- dashboard.module.css
|   |   |   |   +-- page.tsx        # Dashboard home (analytics)
|   |   |   +-- widget/[agentId]/   # Widget mini-app (iframe)
|   |   +-- components/
|   |   |   +-- ui/                 # Design system (Button, Input, Modal, Card, Badge, Table, etc.)
|   |   |   |   +-- Logo/          # Logo.tsx -- Handjet Bold 700, "Gen" negro + "Smart" verde
|   |   |   +-- layout/            # Footer (EN/ES selector), PublicNavbar (translated)
|   |   |   +-- landing/           # Hero, Features, HowItWorks, ProblemSolution, ChannelsSection,
|   |   |   |                       # CRMPreview, Pricing, Testimonials, FAQ, BlogPreview -- ALL translated
|   |   |   +-- agents/            # AgentCard, AgentEditor, PromptEditor, MCPConfigurator (NEW),
|   |   |   |                       # ToolConfigurator (i18n updated) -- ALL translated
|   |   |   +-- conversations/     # ConversationList, ChatView, TakeoverBanner -- ALL translated
|   |   |   +-- crm/              # ContactList, ContactDetail + sub-components -- ALL translated
|   |   |   +-- funnel/           # KanbanBoard, FunnelStats -- ALL translated
|   |   |   +-- calendar/         # CalendarView, AppointmentModal -- ALL translated
|   |   |   +-- billing/          # CurrentPlan, UsageBars, AddOnCards, etc. -- ALL translated
|   |   |   +-- notifications/    # NotificationBell, NotificationList -- ALL translated
|   |   |   +-- dashboard/        # StatsCards, LeadsChart, FunnelOverview, TopAgents, RecentLeads -- ALL translated
|   |   +-- contexts/             # AuthContext, LanguageContext
|   |   +-- hooks/                # useAuth, useScrollReveal, useWebSocket, useNotifications, useTranslation
|   |   +-- lib/                  # api.ts, blog.ts (with language filter), constants, utils, formatters.ts
|   |   +-- i18n/                 # en.json, es.json (650+ keys each, including MCP + tool modal keys)
|   |   +-- content/blog/         # 3 EN posts + 3 ES posts (with language frontmatter)
|   |   +-- public/               # widget.js, images, favicon, robots.txt, sitemap.xml
|   |
|   +-- api/                      # Express.js 5 -- Port 4000
|       +-- src/
|           +-- config/           # database, redis, stripe, encryption, env, websocket, email (bilingual), jwt, queues
|           +-- middleware/       # auth, orgContext, planLimits, rateLimiter, errorHandler, validate, validateUUID
|           +-- routes/           # auth, agents (+ MCP test-connection), conversations, contacts, funnel, calendar,
|           |                      # billing, whatsapp, widget, mobile(stub), knowledge, organization, notifications,
|           |                      # dashboard, account (GDPR)
|           +-- services/         # auth, agent, llm, conversation, message-buffer, variable-capture, rag, embedding,
|           |                      # scraping, ai-scoring, calendar, appointment, stripe, email, notification (bilingual),
|           |                      # usage, whatsapp, custom-function, organization, sub-account, contact,
|           |                      # mcp-client (NEW -- SSE transport, connectAndListTools, executeMCPTool)
|           +-- workers/          # message (+ MCP tool loading/execution), rag, scraping, scoring, reminder, export
|           +-- db/
|           |   +-- migrations/   # 001-026 (26 total, NO new migrations in Fase 12.1)
|           |   +-- queries/
|           |   +-- seeds/        # stripe-products.ts
|           +-- types/            # express.d.ts, speakeasy.d.ts
|           +-- index.ts          # Entry point (Stripe webhook inline BEFORE express.json())
|
+-- packages/shared/              # types, constants (PLAN_LIMITS with mcp_servers, PRICING, MESSAGE_ADDONS), validators (Zod)
+-- infra/                        # docker-compose.yml, nginx config
+-- .env                          # All environment variables
+-- spec.md                       # Full technical specification
+-- dev-plan.md                   # Development plan
```

### Stack Tecnico:
```
Frontend:  Next.js 16 (App Router) -- Port 3000
Backend:   Express.js 5 -- Port 4000
Database:  PostgreSQL 16 + pgvector (26 migrations applied)
Cache:     Redis (BullMQ queues + usage counters + message buffer + session cache + notification dedup + MCP tool cache)
Workers:   6 active (message, rag, scraping, scoring, reminder, export)
WebSocket: socket.io (real-time conversations, billing events, notifications)
LLM:       OpenAI (GPT-4o-mini, text-embedding-ada-002) + Anthropic (configured)
Payments:  Stripe test mode (subscriptions, add-ons, customer portal, webhooks)
i18n:      EN/ES bilingual (650+ keys, LanguageContext, useTranslation, Intl.* formatters)
Email:     Nodemailer + SMTP (bilingual templates). Production: Resend (configured later)
MCP:       Custom SSE client, Redis-cached tool definitions (1hr TTL), prefixed tool names for LLM
Monorepo:  npm workspaces + Turborepo
```

---

## 7. Convenciones Obligatorias

- **CSS Modules** (NO Tailwind) -- `.module.css` junto a cada componente
- **lucide-react** para TODOS los iconos (NUNCA emojis)
- **Font:** Inter (Google Fonts)
- **Paleta:** Beige (#FAF8F5) fondo, Verde WhatsApp (#25D366) primario, ver spec.md seccion 4 para todos los tokens
- **Auth:** Custom JWT -- access token en memoria JS (NUNCA localStorage), refresh httpOnly cookie
- **API client:** `apps/web/lib/api.ts` -- `api.get()`, `api.post()`, `api.put()`, `api.delete()` con interceptor 401->refresh->retry. Exporta `getAccessToken()` para WebSocket auth.
- **Validacion:** Zod en backend para todos los inputs
- **WebSocket:** socket.io -- `getIO().to('org:{orgId}').emit(event, data)`. Events: `conversation:update`, `message:new`, `variables:update`, `contact:scored`, `takeover:status`, `usage:limit_reached`, `notification:new`
- **Logo:** `components/ui/Logo/Logo.tsx` -- Handjet Bold 700, "Gen" negro + "Smart" verde
- **Timezone:** Almacenar UTC, display con Intl.DateTimeFormat
- **Stripe Webhook:** Handler inline en index.ts ANTES de express.json(), usa express.raw(). NO mover a router.
- **Dashboard layout:** Sidebar + Header estan en `dashboard/layout.tsx` (NO en componentes separados). NotificationBell esta en headerRight.
- **Notifications dedup:** Redis keys `notif:usage80:{orgId}:{YYYY-MM}` y `notif:usage100:{orgId}:{YYYY-MM}` con TTL 35 dias
- **Charts:** SVG puro (sin librerias de charts) -- ver LeadsChart.tsx como referencia
- **i18n:** `useTranslation()` hook + `t('key.path')` en cada componente. `LanguageContext` provee idioma. `formatDate/formatNumber` con locale del usuario. Agregar keys a ambos JSON (en + es) cuando se crean nuevos componentes.
- **Blog posts:** Frontmatter requiere `language: "en"` o `language: "es"`. Filtrado automatico por idioma activo.
- **Email templates:** Bilingual -- consultar `users.language` antes de enviar
- **MCP tool names:** Prefijo `mcp_{sanitizedServerName}_{toolName}` para distinguir de tools nativas. Mapping reverso en mcpToolMap.
- **MCP cache:** Redis key `mcp:tools:{agent_tool_id}`, TTL 1 hora. Invalidar al guardar/modificar MCP tool.
- **Git:** Commit al final de cada sub-fase

---

## 8. Datos de Testing Actuales

### Organizacion principal:
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
- **Tools:** Knowledge Base, Scheduling, **MCP Server ("Everything Server" — 13 tools, http://localhost:3001/sse)**

### Calendario:
- **ID:** `0e53f645-8a3e-4a67-9446-d34c52b364d8`
- **Timezone:** America/Bogota
- **Linked to:** Agente de Prueba

### Contactos (3+):
| Nombre | Email | Score | Stage | Service | agent_id |
|--------|-------|-------|-------|---------|----------|
| Carlos | carlos@test.com | 10/10 | Customer | SEO | 066d2687... |
| Vito teran | vito@yopmail.com | 8/10 | Customer | SEO | 066d2687... |
| Genner | genner@yopmail.com | 4/10 | Customer | unknown | 066d2687... |

**Nota:** El MCP tool "Everything Server" apunta a localhost:3001/sse que es un server de prueba local (`npx @modelcontextprotocol/server-everything sse`). No estara corriendo en produccion. Es solo para desarrollo/testing.

### Blog Posts (6):
- EN: whatsapp-agent-deploy, ai-lead-scoring-crm, n8n-vs-gensmart
- ES: como-desplegar-agente-whatsapp-ia, lead-scoring-ia-crm, gensmart-vs-n8n-automatizacion

---

## 9. Bugs Conocidos Pendientes

### Menores (no bloquean):
1. **Notificaciones duplicadas por scoring rapido** -- edge case cuando se envian mensajes consecutivos rapidos. Considerar dedup por conversationId+type. No critico.
2. **WebSocket disconnect/reconnect** frecuente en console -- cosmetico, sin impacto funcional
3. **`util._extend` deprecation** en Next.js -- interno de Next.js, no accionable
4. **Contacts "Unknown"** -- sesiones de widget sin variable capture, comportamiento esperado

### Billing (legacy, menor):
5. **Suscripciones duplicadas de test en Stripe** -- 3 Starter extras por debugging de webhooks, ya canceladas. Limpiar en Stripe dashboard.

### Para Fase 12.3 (Polish):
6. **Responsive mobile view** -- no probado exhaustivamente
7. **Blog posts sin imagenes de cover** -- los posts referencian imagenes que no existen (`/images/blog/*.jpg`). Crear o usar placeholders.

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
- Webhook secret (`whsec_...`) changes each time `stripe listen` restarts -- update .env
- Test card: `4242 4242 4242 4242`
- Handler is inline in `index.ts` BEFORE `express.json()` -- DO NOT move to router

---

## 11. Como Iniciar el Proyecto

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
2. **Express 5 middleware ordering:** Estricto. `app.post('/path', middleware, handler)` antes de `app.use(express.json())` es la forma mas segura
3. **Stripe CLI secret rota:** Verificar siempre que `.env` tiene el `whsec_` actual
4. **Message buffer optimiza tokens:** Agregar multiples mensajes rapidos en una sola llamada LLM ahorra ~60% de tokens vs procesamiento individual
5. **Variable capture como tool invisible:** El LLM llama `capture_variable()` naturalmente durante la conversacion -- mas efectivo que formularios
6. **CSS Modules > Tailwind para este proyecto:** Scoped styles, sin dependencias, control total sobre el design system
7. **PostgreSQL RLS para multi-tenancy:** Policies a nivel de row garantizan aislamiento de datos entre organizaciones
8. **Idempotencia en webhooks:** `stripe_event_id` UNIQUE + `ON CONFLICT DO NOTHING` previene procesamiento duplicado
9. **Column is_active no existe en users:** Claude Code asumio la existencia de esta columna. Siempre verificar schema real antes de asumir columnas. (Hotfix #24)
10. **Charts SVG vs librerias:** SVG puro para LeadsChart funciona bien y mantiene 0 dependencias extra.
11. **Notification dedup via Redis:** Keys con TTL de 35 dias previenen notificaciones duplicadas por periodo.
12. **Dashboard no usa route group `(dashboard)`:** La carpeta es `app/dashboard/` directamente, NO `app/(dashboard)/`.
13. **Stripe subscriptions.update() para cambios de plan:** NUNCA crear nueva suscripcion. Usar `subscriptions.update()` con `proration_behavior: 'create_prorations'`. (Hotfix #25)
14. **contacts.agent_id puede ser NULL:** Contactos creados antes del fix #31 podian no tener agent_id. Queries de dashboard deben JOINear via conversations. (Hotfixes #29, #30, #31)
15. **DELETE contacts requiere transaccion:** FK constraints con messages, conversations, appointments. Orden: messages -> appointments (NULL) -> conversations -> contact. (Hotfix #32)
16. **i18n wiring es trabajo pesado:** Claude Code tiende a crear la infraestructura pero NO traduce todos los componentes. Requiere prompts de seguimiento explicitos componente por componente.
17. **Landing components necesitan 'use client':** Para usar `useTranslation()`, los componentes de landing deben ser client components.
18. **Blog posts necesitan `language` en frontmatter:** Sin este campo, `/blog` muestra todos los posts sin filtrar.
19. **Email templates bilingual:** `notification.service.ts` usa `EMAIL_STRINGS` map con templates EN/ES.
20. **Email provider produccion: Resend** -- elegido por simplicidad y free tier (3,000/mes). Configurar en Fase 12.4 (Deploy).
21. **MCP client debe ser stateless:** Cada operacion (list tools, execute tool) abre conexion SSE, ejecuta, cierra. No mantener conexiones persistentes para evitar memory leaks.
22. **MCP tool names necesitan sanitizacion:** Nombres de tools MCP pueden tener caracteres invalidos para OpenAI/Anthropic. Sanitizar a [a-zA-Z0-9_] y agregar prefijo mcp_{serverName}_{toolName}. Mantener mapping reverso.
23. **MCP cache en Redis es esencial:** Sin cache, cada mensaje requeriria conectar al MCP server para obtener tool definitions. Cache con TTL 1 hora reduce latencia drasticamente.
24. **MCP edit mode necesita mostrar tools guardadas:** Al abrir Edit de un MCP tool, mostrar las selected_tools sin requerir reconexion. El usuario puede hacer Test Connection para refrescar. (Hotfix #33)
25. **ToolConfigurator necesita i18n completo:** Los strings del modal Add/Edit Tool (titulo, labels, nombres de tool types) deben traducirse igual que el resto del UI. (Hotfix #33)

---

## 13. E2E Testing Results -- Fase 12.1 (MCP)

| Test | Resultado |
|------|-----------|
| MCP Server aparece en Tool Types del modal | OK |
| Test Connection con URL invalida -> error descriptivo (ENOTFOUND) | OK |
| Test Connection con MCP server real -> 13 tools detectadas | OK |
| Lista de tools con checkboxes + Select All / Deselect All | OK |
| Guardar MCP tool -> aparece en lista de tools del agente | OK |
| Preview/Sandbox: echo tool funciona ("Hello from MCP") | OK |
| Preview/Sandbox: add tool funciona (25+17=42) | OK |
| Toggle enable/disable del MCP tool | OK |
| Widget real: MCP tool funciona ("MCP works in production") | OK |
| Edit MCP tool: restaura selected_tools (13 tools saved) | OK (HF-33) |
| Edit MCP tool: muestra Available Tools con checkboxes | OK (HF-33) |
| i18n: labels MCP traducidos (URL del Servidor, Probar Conexion, etc.) | OK |
| i18n: modal Add Tool completamente traducido (Agregar Herramienta, TIPO DE HERRAMIENTA, etc.) | OK (HF-33) |

---

## 14. Fase 5b -- Lo Que Debe Implementarse (WhatsApp Integration)

```
Segun spec.md y dev-plan.md:

Backend:
- Webhook verification (GET /api/whatsapp/webhook) con verify_token de Meta
- Message handling (POST /api/whatsapp/webhook) con signature validation (x-hub-signature-256)
- whatsapp.service.ts: send text message, mark as read via Meta Cloud API
- Embedded Signup callback endpoint (POST /api/whatsapp/embedded-signup)
- Connect endpoint (POST /api/whatsapp/connect) para configuracion manual
- Status check (GET /api/whatsapp/status/:agentId)
- Integrar con message worker: mensajes de WhatsApp entran al mismo pipeline
  (buffer -> LLM con tools/MCP/RAG -> respuesta -> enviar via Meta API)

Frontend:
- /agents/[id]/channels tab:
  - Embedded Signup flow (Facebook Login SDK) -- opcion recomendada
  - Manual setup con step-by-step guide -- opcion fallback
  - Connection status indicator (connected/disconnected)
  - Phone number display cuando conectado
- Docs page /docs/whatsapp-setup como fallback para setup manual

Database:
- agents.whatsapp_config JSONB YA EXISTE:
  {"phone_number_id":null,"waba_id":null,"access_token_encrypted":null,
   "verify_token":null,"connected":false}
- Columna ya presente en la tabla agents, solo necesita llenarse

Plan limits:
- Free: Web only (NO WhatsApp)
- Starter: Web + WhatsApp
- Pro: Web + WhatsApp
- Enterprise: Web + WhatsApp

Notas:
- Los agentes de WhatsApp tendran acceso a MCP tools (ya implementado)
- Los agentes de WhatsApp comparten el mismo message worker
- Contactos de WhatsApp usan phone como identificador principal
- Traducir nuevos strings a EN/ES
- CSS Modules, lucide-react
- Meta Cloud API requiere HTTPS en produccion para webhooks
  (en desarrollo se puede usar ngrok o similar)
```

---

## 15. Notas para Fase 12.3 (Polish) -- Pendientes Acumulados

Incluir estos items cuando se genere el prompt de Polish:
1. **Blog posts sin imagenes de cover** -- crear o usar placeholders
2. **Blog filtrado por idioma en landing BlogPreview** -- ya funciona, verificar
3. **Responsive mobile view** -- testing exhaustivo
4. **Limpiar suscripciones de test duplicadas en Stripe**
5. **MCP "Everything Server" apunta a localhost** -- para produccion necesitara MCP servers reales o eliminarse

---

## 16. Prompt para Claude Code -- Fase 5b (WhatsApp)

```
Lee spec.md y dev-plan.md en la raiz del proyecto.
Lee tambien este checkpoint para contexto completo del estado actual.

Ejecuta la Fase 5b completa (WhatsApp Integration).

[El prompt detallado se generara en la proxima conversacion con toda
la especificacion de WhatsApp del spec.md seccion 5.1, 9.5, y los
endpoints de la seccion 8.]

CSS Modules, lucide-react, paleta de colores del spec.
Traducir TODOS los strings nuevos a EN/ES.
Git commit al final de cada sub-fase.
```