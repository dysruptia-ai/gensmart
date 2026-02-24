# GenSmart — Plan de Desarrollo para Claude Code v2.0

> **Objetivo:** Llevar el proyecto de 0% a 100% en el menor tiempo posible  
> **Estrategia:** Fases incrementales, cada fase entregable y funcional  
> **Herramienta de ejecución:** Claude Code

---

## Instrucciones Generales para Claude Code

Antes de cada fase, lee completo `spec.md` en la raíz del proyecto. Contiene toda la especificación.

**Reglas:**
- Monorepo con npm workspaces + Turborepo
- TypeScript estricto en todo el proyecto
- CSS Modules (sin librerías CSS de terceros)
- Iconos: lucide-react (NUNCA emojis)
- Font: Inter (Google Fonts)
- Paleta de colores: spec.md sección 4
- PostgreSQL 16 + pgvector
- Redis + BullMQ para colas y contadores
- Zod para validación
- Idiomas: en (default) + es
- Auth: Custom JWT desde cero (NO NextAuth)
- Cada agente debe tener avatar configurable con fallback de iniciales

**Prompt para iniciar cada fase:**
```
Lee spec.md y dev-plan.md. Ejecuta la Fase [N] completa.
Sigue las tareas en orden. Verifica que cada tarea funciona antes de avanzar.
CSS Modules, lucide-react, paleta de colores del spec.
Git commit al final de cada sub-fase.
```

---

## FASE 0 — Fundación (Día 1-2)

### 0.1 Scaffolding del Monorepo
```
1. Inicializar monorepo raíz con npm workspaces
2. Configurar Turborepo (turbo.json)
3. TypeScript base + por package
4. apps/web → Next.js 16 (App Router)
5. apps/api → Express.js 5 (TypeScript, tsx)
6. packages/shared → types, constants, validators (Zod)
7. ESLint + Prettier
8. .env.example con TODAS las variables
9. docker-compose.yml → PostgreSQL 16 + Redis (dev)
10. Scripts raíz: dev, build, db:migrate, db:seed
```

### 0.2 Base de Datos
```
1. Conexión PostgreSQL con pg + pool
2. Habilitar pgvector extension
3. Sistema de migraciones (node-pg-migrate)
4. Crear TODAS las migraciones SQL del spec.md sección 7 (incluyendo auth tables)
5. Seeds: plantillas de agentes, planes
6. Verificar tablas, índices, constraints
```

### 0.3 Design System
```
1. globals.css: reset, variables colores, tipografía Inter, spacing, shadows, breakpoints
2. Componentes UI (cada uno con .module.css):
   Button, Input, Modal, Card, Badge, Table, Dropdown, Toast, Tabs, Avatar (con initials fallback),
   Spinner, EmptyState, SearchInput, ProgressBar, Toggle, Tooltip, Skeleton, ColorPicker
3. Página temporal /design-system para verificar visualmente
```

---

## FASE 1 — Auth Custom + Multi-tenancy (Día 3-5)

### 1.1 Backend Auth (Custom, sin NextAuth)
```
1. Middleware base: errorHandler, validate (Zod), rateLimiter
2. auth.service.ts:
   - register: validate → bcrypt hash → create org + user + Stripe customer → generate JWT
   - login: validate email+password → if 2FA → return temp_token → else → JWT tokens
   - refresh: validate httpOnly cookie → rotate refresh token → new access token
   - logout: invalidate refresh token
   - forgotPassword: generate token → send email
   - resetPassword: validate token → update password hash
3. 2FA TOTP:
   - setup: speakeasy generate secret + QR → return
   - enable: verify code → save encrypted secret + generate 10 backup codes
   - verify: validate temp_token + TOTP code (or backup code)
   - disable: verify password → remove secret
4. JWT middleware: verify access token → inject user in req
5. orgContext middleware: inject organization → verify membership
6. Refresh token rotation with reuse detection
7. AES-256 encryption utils for secrets
```

### 1.2 Frontend Auth (Custom)
```
1. AuthContext (React Context):
   - Stores access token in memory (NEVER localStorage)
   - Exposes: user, isAuthenticated, login(), logout(), register()
   - Auto-refresh timer before token expires
2. api.ts HTTP client:
   - Authorization header interceptor
   - 401 → try refresh → retry request → fail → redirect /login
3. Next.js middleware: check refresh cookie for /dashboard/* routes
4. Auth pages: /login, /register, /forgot-password, /reset-password/[token]
5. 2FA setup component: QR code display + verification input + backup codes
6. All forms with loading, error, success states
```

### 1.3 Multi-tenancy & Sub-accounts
```
1. Backend: CRUD organization, members (invite by email, roles), sub-accounts
2. Frontend: /settings (general), /settings/team, /settings/sub-accounts, /settings/security (2FA)
3. PostgreSQL Row Level Security
```

---

## FASE 2 — Landing Page (Día 6-8)

### 2.1 Landing Page
```
1. Layout público: PublicNavbar + Footer
2. Implementar TODAS las secciones del spec sección 5:
   Hero, Social Proof, Problem/Solution, Features Grid, How It Works,
   Channels, CRM Preview, Pricing, Testimonials, FAQ, Final CTA, Footer
3. Cada sección como componente independiente con CSS Module
4. Responsive: mobile-first
5. Animaciones sutiles (scroll reveal, hover states)
6. SEO: meta tags, JSON-LD, sitemap, robots.txt, semantic HTML
7. Core Web Vitals optimization
```

### 2.2 Pricing Page
```
1. /pricing con tabla detallada de planes
2. Toggle: Monthly / Quarterly / Yearly (con descuentos)
3. Feature comparison table completa
4. CTA por plan → register o checkout
```

### 2.3 Blog
```
1. Markdown files en /content/blog/
2. Frontmatter parsing (gray-matter)
3. SSG en build time
4. /blog → lista con paginación
5. /blog/[slug] → post individual con SEO
6. Crear 2-3 posts iniciales placeholder
```

---

## FASE 3 — Agentes AI Core (Día 9-13)

### 3.1 CRUD de Agentes
```
Backend: CRUD completo, versionado al publicar, rollback, plantillas
Frontend:
- /agents → grid con AgentCards (nombre, avatar, status, canales, último uso)
- /agents/new → wizard (template o desde cero)
- /agents/[id] → editor: tabs Prompt, Variables, Settings
- Avatar uploader con fallback iniciales
- Historial de versiones
```

### 3.2 Variables Editor
```
Frontend: VariablesEditor component
- Add/remove/reorder variables
- Per variable: name, type (string/enum), required, description, options (for enum)
- Preview of how variables inject into system prompt
```

### 3.3 AI Prompt Generator
```
Backend: POST /api/agents/generate-prompt
Frontend: Modal → textarea → "Generate with AI" → preview prompt + suggested variables → "Apply"
```

### 3.4 Herramientas del Agente
```
Backend: CRUD tools, validation per type
Frontend: /agents/[id]/tools
- Tool catalog: scheduling, rag, web_scraping, custom, mcp
- Configurator per type:
  - Scheduling: select calendar, slot duration
  - RAG: upload files, add URLs
  - Custom: endpoint, method, headers, auth, params (JSON Schema), body template, response mapping, test button
  - MCP: server URL, test connection, select tools
- Toggle enable/disable
```

### 3.5 LLM Service (Multi-provider)
```
llm.service.ts: unified interface chat(), stream(), generateEmbedding()
- OpenAI adapter (GPT-4o, GPT-4o-mini)
- Anthropic adapter (Claude Sonnet, Haiku)
- Unified tool calling
- Error handling, retries, rate limits
- Token tracking per call
- Plan enforcement: check allowed models
```

---

## FASE 4 — Motor de Conversación (Día 14-19)

### 4.1 Message Buffer
```
Redis + BullMQ buffer. Configurable delay per agent (default 5s).
Aggregates multiple messages → single LLM call.
message.worker.ts: loads context (prompt + variable instructions + RAG + history within context window limit) → LLM → save response → send to channel → increment usage counter.
```

### 4.2 Variable Capture Service
```
variable-capture.service.ts:
- Internal tool capture_variable registered for LLM
- Intercepts tool_call → stores in conversation.captured_variables
- Syncs to contact (base fields: name/phone/email → columns, rest → custom_variables JSONB)
- Real-time update via WebSocket
```

### 4.3 RAG Pipeline
```
Backend: upload (.md, .pdf), web scraping
Workers: extract text → chunk (500 tokens, 50 overlap) → embed (ada-002) → store pgvector
Query: embed user message → top-5 chunks (cosine) → inject as context
Frontend: /agents/[id]/knowledge — drag-drop upload, URL input, file list with status
```

### 4.4 Conversations & Chat View
```
Backend: list with filters, detail with paginated messages, WebSocket for real-time
Frontend:
- /conversations → list (name, last msg, channel badge, status)
- /conversations/[id] → chat view (WhatsApp-style), VariablesSidebar, contact info
```

### 4.5 Human Takeover
```
Backend: takeover, release, send message as human, pause worker
Frontend: TakeoverBanner, input (only in takeover mode), visual distinction AI vs human msgs
Post-release: generate intervention summary for agent context
```

### 4.6 Preview/Sandbox
```
Backend: POST /api/agents/:id/preview → uses draft prompt, all tools, no real conversation
Frontend: chat panel in agent editor, Reset button, metadata display (tokens, tools, latency)
Does NOT affect usage counters
```

---

## FASE 5 — Canales: WhatsApp + Web Widget (Día 20-25)

### 5.1 WhatsApp Integration
```
Backend:
- Webhook verification (GET) + message handling (POST) with signature validation
- whatsapp.service.ts: send text, mark as read
- Embedded Signup callback endpoint
- connect endpoint + status check
Frontend: /agents/[id]/channels
- Embedded Signup flow (Facebook Login SDK)
- Manual setup with step-by-step guide
- Connection status indicator
- Docs page /docs/whatsapp-setup as fallback
```

### 5.2 Web Widget
```
1. widget.js (<20KB minified): inject iframe, read data-agent-id, bubble + chat panel
2. Widget mini-app (React, in iframe): branded chat, session persistence
3. Backend: public endpoints (CORS *), session management, SSE/polling for messages
4. Frontend dashboard:
   - WidgetCustomizer (ColorPicker, avatar, position, welcome message)
   - Live preview
   - Code snippet (copyable)
5. Rate limiting: 30 msgs/session, invisible CAPTCHA, IP blocking
```

---

## FASE 6 — CRM + Funnel (Día 26-30)

### 6.1 CRM (Contacts)
```
Backend: CRUD with filters, pagination, search, CSV export
AI Scoring service: after conversation close → LLM extracts summary, score, service, variables → update contact
Frontend:
- /contacts → table (name, phone, email, agent, ScoreBadge, funnel stage, service, date)
- /contacts/[id] → header, AI summary, variables, conversations, timeline, notes, funnel stage editor
```

### 6.2 Funnel Kanban
```
Backend: contacts grouped by stage, stats, move
Frontend: /funnel → 3 columns (Lead | Opportunity | Customer), drag-drop, counters, metrics, agent filter
```

### 6.3 AI Scoring Worker
```
scoring.worker.ts: trigger on conversation close or N messages
LLM prompt → extract summary, score 0-10, service, variables → update contact
Auto-move funnel stage based on score (configurable)
Manual "Re-analyze" button in dashboard
```

---

## FASE 7 — Calendario (Día 31-33)

```
Backend: CRUD calendars, appointments, available-slots calculation, reminder jobs
Tool integration: agent calls check_availability/book_appointment
Frontend: /calendar → monthly view, appointment blocks colored by agent, click for detail modal, filters
Calendar config in /agents/[id]/tools
```

---

## FASE 8 — Billing con Stripe (Día 34-36)

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

---

## FASE 9 — Notifications + Dashboard Analytics (Día 37-38)

### 9.1 Notifications
```
Backend: notification.service.ts, CRUD endpoints, WebSocket for real-time badge
In-app: bell icon with unread count, dropdown list, mark as read
Email: Nodemailer for critical events (high score lead, plan limits)
```

### 9.2 Dashboard Home
```
Backend: /api/dashboard/* endpoints with aggregated queries
Frontend: / (dashboard home)
- KPI cards: Leads (day/week/month), Active Conversations, Avg Score, Messages Used/Limit
- Charts: Leads Over Time (7d/30d/90d), Funnel Overview with conversion %
- Tables: Top Agents, Recent High-Score Leads
```

---

## FASE 10 — i18n + GDPR (Día 39-40)

### 10.1 i18n
```
1. /i18n/en.json + /i18n/es.json (ALL keys)
2. useTranslation() hook
3. Translate ALL UI
4. Language selector in settings + landing footer
5. Date/number formatting per locale
```

### 10.2 GDPR
```
Backend: export data (ZIP worker), delete account (30 day grace), delete contact (hard delete)
Frontend: /settings/data → Export my data, Delete my account (with confirmation flow)
```

---

## FASE 11 — App Móvil (Día 41-45)

```
React Native (Expo), TypeScript
ONLY for Web agents (NOT WhatsApp)

Screens:
- Login (email+password or QR scan from dashboard)
- Agents list (only web channel agents)
- Conversations list per agent
- Chat view + human takeover
- Settings (logout, language)

Features:
- QR scan → JWT auth
- Real-time messages (WebSocket)
- Takeover/release from mobile
- Share packages/shared types
```

---

## FASE 12 — MCP + Polish + Deploy (Día 46-50)

### 12.1 MCP Integration
```
mcp-client.service.ts: connect to MCP server (SSE/streamable-http), list tools, execute tool calls
Frontend: MCP configurator (URL, test connection, select tools)
```

### 12.2 Testing
```
Unit tests: services, utils, validators
Integration tests: API endpoints with supertest
E2E: register → create agent → chat → CRM flow
Load testing: message buffer under load
```

### 12.3 Performance
```
PostgreSQL: EXPLAIN ANALYZE, missing indexes
Redis caching: agent config, widget config
Lazy loading, Image optimization, Error boundaries
Loading skeletons, Responsive check, Accessibility (aria labels, keyboard nav)
```

### 12.4 Deploy to AWS Lightsail
```
1. Create Lightsail instance (4GB, 2 vCPUs)
2. Setup: Node.js 20, PostgreSQL 16 + pgvector, Redis 7, Nginx, Certbot, PM2
3. Nginx config: gensmart.ai → Next.js, api.gensmart.ai → Express
4. PM2 ecosystem: next-app, express-api, worker-messages, worker-rag, worker-scoring, worker-scraping
5. Backups: pg_dump cron daily, Lightsail snapshot weekly
6. Deploy script: git pull → npm install → build → migrate → restart PM2
7. DNS + SSL
8. Configure Stripe + Meta webhooks with production URLs
9. Smoke test all critical flows
```

---

## Timeline Summary

| Fase | Descripción | Días | Acumulado |
|------|-------------|------|-----------|
| 0 | Fundación (scaffolding, BD, design system) | 2 | 2 |
| 1 | Auth Custom + Multi-tenancy | 3 | 5 |
| 2 | Landing Page + Pricing + Blog | 3 | 8 |
| 3 | Agentes AI Core | 5 | 13 |
| 4 | Motor de Conversación | 6 | 19 |
| 5 | Canales: WhatsApp + Web Widget | 6 | 25 |
| 6 | CRM + Funnel + AI Scoring | 5 | 30 |
| 7 | Calendario | 3 | 33 |
| 8 | Billing (Stripe) | 3 | 36 |
| 9 | Notifications + Dashboard Analytics | 2 | 38 |
| 10 | i18n + GDPR | 2 | 40 |
| 11 | App Móvil | 5 | 45 |
| 12 | MCP + Polish + Testing + Deploy | 5 | 50 |

**Total estimado: ~50 días con Claude Code.**

---

## Orden de Prioridad si hay que recortar

Si necesitas lanzar más rápido, estas features se pueden mover a post-MVP:
1. App Móvil (Fase 11) — se puede reemplazar con dashboard responsive
2. MCP integration (Fase 12.1) — feature avanzado
3. Blog — se puede lanzar sin blog inicialmente
4. Sub-cuentas — se puede simplificar a cuentas independientes
5. Embedded Signup WhatsApp — usar solo guía manual

Esto reduciría a ~35-38 días para un MVP funcional.
