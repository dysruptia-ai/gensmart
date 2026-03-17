# GenSmart — Checkpoint Post-Fase 3

> **Fecha:** 2026-02-25
> **Estado:** FASE 0 ✓ + FASE 1 ✓ + FASE 2 ✓ + FASE 3 ✓ + BUGFIXES ✓ + HOTFIXES #1/#2/#3 ✓
> **Pruebas E2E:** Fase 1 ✓ + Fase 2 ✓ + Fase 3 ✓ (todas verificadas)
> **Próxima fase:** Fase 4 — Motor de Conversación

---

## Fase 3 — Completada ✓

### Commits realizados:
```
[fase3]   feat: Phase 3.1 - Agent CRUD with editor, templates, versioning, avatar upload
[fase3]   feat: Phase 3.2 - Variables editor with drag-reorder, inline edit, injection preview
[fase3]   feat: Phase 3.3 - AI prompt generator with suggested variables and tools
[fase3]   feat: Phase 3.4 - Agent tools CRUD with configurators (scheduling, RAG UI, custom functions, MCP UI)
[fase3]   feat: Phase 3.5 - LLM service with OpenAI + Anthropic adapters, unified tool calling, plan enforcement
[hotfix1] fix: resolve Phase 3 critical bugs (editor params, plan limits, agent card duplicate, UUID validation)
[hotfix2] e17f5b2 fix: resolve 19 Phase 3 E2E bugs (plan enforcement, tool configs, prompt generator, avatar, toggle)
[hotfix3] 01ae9b4 refactor: unify web scraping into Knowledge Base tool, remove separate Web Scraping type
```

### Sub-fase 3.1 — Agent CRUD ✓
- **Backend:** `agent.service.ts` — full CRUD (create, read, update, delete), versionado al publicar, rollback, plantillas, duplicar
- **Rutas:** GET/POST /api/agents, GET/PUT/DELETE /api/agents/:id, POST publish/rollback/duplicate/avatar
- **Avatar upload:** multer + sharp (resize 200x200), PNG/JPG, max 2MB, endpoint POST /api/agents/:id/avatar
- **Seeds:** 3-5 plantillas en agent_templates (Lead Capture, Customer Support, Appointment Booking, E-commerce, Real Estate)
- **Frontend /agents:** grid de AgentCards (avatar con iniciales fallback, nombre, descripción, status badge, canales, menú dropdown Edit/Duplicate/Delete)
- **Frontend /agents/new:** wizard con 2 opciones (From Template grid + From Scratch form)
- **Frontend /agents/[id]:** editor con tabs (Prompt, Variables, Tools, Settings, Versions), header con avatar clickeable + AvatarUploader, botones Save/Preview/Publish
- **Plan enforcement:** límite de agentes por plan (Free=1, Starter=3, Pro=10, Enterprise=∞), ProgressBar "X/Y agents"
- **UUID validation middleware:** `validateUUID()` aplicado en todas las rutas con :id params

### Sub-fase 3.2 — Variables Editor ✓
- **VariablesEditor component:** accordion list con add/delete/reorder, inline editing
- Tipos: string, enum (con chips de opciones)
- Required toggle, description por variable
- **Preview de inyección LLM:** muestra en real-time cómo se inyectarán las variables al system prompt
- Deduplicación: al aplicar variables desde Prompt Generator, no se duplican (merge by name)
- Persistencia en `agents.variables` (JSONB array)

### Sub-fase 3.3 — AI Prompt Generator ✓
- **Backend:** POST /api/agents/generate-prompt → llama GPT-4o-mini con meta-prompt → retorna system_prompt + suggested_variables + suggested_tools
- **Frontend:** modal con textarea descripción + language toggle (EN/ES) + Generate button
- Resultado: preview prompt readonly + variable chips + tool badges
- Botones: Apply Prompt, Apply Variables, Apply All — todos cierran modal
- Warning si ya existe prompt ("This will replace your current prompt")
- Variables se deduplican al aplicar (no se repiten)

### Sub-fase 3.4 — Agent Tools ✓
- **CRUD:** GET/POST/PUT/DELETE /api/agents/:id/tools, POST test
- **4 tipos en catálogo:** Custom Function, Scheduling, Knowledge Base, MCP Server
- **Custom Function Builder completo:**
  - Tool Name, Description, Endpoint URL, HTTP Method (GET/POST/PUT/PATCH)
  - Headers key-value editor (add/remove pairs)
  - Authentication (None / Bearer Token / API Key Header / API Key Query)
  - Parameters editor (name, type, description, required) → genera JSON Schema
  - Body Template (JSON con placeholders {{param}})
  - Response Mapping (Path + Display Format)
  - Timeout slider (1s - 30s)
  - Test panel colapsable (inputs dinámicos por parámetro → Run Test → response + latencia)
- **Scheduling:** Tool Name, Description, Scheduling Type, Timezone, Calendar dropdown (loads from GET /api/calendars), preview de funciones (check_availability, book_appointment)
- **Knowledge Base (RAG):**
  - Documents: drag-drop file upload (.pdf, .md, .txt, .docx)
  - File list con status badges (processing/ready/error) + polling 5s
  - Web Pages section: input URL + "Add URL" + lista URLs con status
  - Allowed Domains (textarea, opcional)
  - Indicador de límite "Documents: X/Y" (cuenta files + URLs, según plan)
  - Botón reprocess por archivo (RefreshCw icon)
  - Nota: procesamiento real (chunking/embedding) se implementa en Fase 4
- **MCP Server:** Server URL, Transport dropdown (SSE / Streamable HTTP), Name
- **Plan enforcement:** Custom Function disabled para Free (badge "Upgrade"), MCP disabled para Free/Starter
- **Toggle enable/disable:** funcional sin errores (fixed controlled/uncontrolled bug)
- **Web Scraping eliminado:** unificado dentro de Knowledge Base, registros existentes backwards compatible

### Sub-fase 3.5 — LLM Service ✓
- **llm.service.ts:** interface unificada chat(), stream(), generateEmbedding()
- **OpenAI adapter:** GPT-4o, GPT-4o-mini, text-embedding-ada-002 (1536 dims), function calling nativo
- **Anthropic adapter:** Claude Sonnet, Claude Haiku, tool_use nativo
- **withRetry:** exponential backoff para 429/500/503 (max 3 retries)
- **Token tracking:** usage logging por llamada
- **Plan enforcement:** modelos filtrados por plan en frontend + validación backend
- **Dependencias:** openai + @anthropic-ai/sdk instalados en apps/api

---

## Bugfixes Aplicados (Fases 1 & 2) ✓

### BF-009: Sidebar mobile → hamburger + backdrop overlay ✓
### BF-010: Team invite email focus fix (onCloseRef + wasOpenRef pattern) ✓
### BF-011: 2FA status syncs from backend, disable flow funcional ✓
### BF-012: /docs/whatsapp-setup placeholder page created ✓
### BF-013: Footer logo size fixed ✓
### BF-014: PublicNavbar cross-page anchor navigation fixed ✓
### BF-015: PublicNavbar authenticated state (shows "Go to Dashboard") ✓

---

## Hotfix #1 — Bugs Críticos Fase 3 ✓

### BUG-016: React.use(params) en todas las rutas dinámicas (Next.js 16 Promise params) ✓
### BUG-017: Redirect post-creación — backend retorna ID, frontend lo lee correctamente ✓
### BUG-018: validateUUID middleware reutilizable en todas las rutas con :id ✓
### BUG-019: Plan limits corregidos — Free=1 agente (no 3) ✓
### BUG-020: Opción "Duplicate" en AgentCard dropdown ✓

---

## Hotfix #2 — 19 Bugs E2E Fase 3 ✓

### Grupo A — Plan Enforcement:
- BUG-021: Modelos LLM filtrados por plan (allowedModels from PLAN_LIMITS) ✓
- BUG-022: Max tokens respeta límite del plan (max attribute + backend clamp) ✓
- BUG-023: Context window respeta límite del plan ✓
- BUG-024: Custom Function disabled para Free (badge "Upgrade" + backend 403) ✓
- BUG-025: MCP disabled para Free/Starter (badge "Upgrade" + backend 403) ✓

### Grupo B — Editor:
- BUG-026: Botón Preview → abre chat modal con draft systemPrompt vía POST /agents/:id/preview ✓
- BUG-027: Avatar clickeable con hover Camera overlay → upload vía POST /agents/:id/avatar (multer) ✓

### Grupo C — Prompt Generator:
- BUG-028: Apply Prompt y Apply Variables cierran el modal ✓
- BUG-029: Variables deduplicadas (merge by name) ✓
- BUG-030: Warning banner + confirm() antes de sobrescribir prompt ✓

### Grupo D — Custom Function:
- BUG-031: Campos completos (Headers, Auth, Body Template, Response Mapping, Timeout, Test panel) ✓
- BUG-032: Toggle checked={checked ?? false} — fixed controlled/uncontrolled ✓

### Grupo E — Scheduling:
- BUG-033: Calendar dropdown (loads from GET /api/calendars) ✓
- BUG-034: Preview funciones check_availability / book_appointment ✓

### Grupo F — Knowledge Base:
- BUG-035: File status badges (processing/ready/error) + polling 5s ✓
- BUG-036: URL input section → POST /agents/:id/knowledge/web ✓
- BUG-037: "Documents: X/Y" limit indicator + upload disabled at limit ✓
- BUG-038: Reprocess button per file (RefreshCw icon) ✓

### Grupo G — MCP:
- BUG-039: Transport dropdown (SSE / Streamable HTTP) ✓

---

## Hotfix #3 — Web Scraping unificado en Knowledge Base ✓

- Web Pages section integrada en Knowledge Base (URL input + Allowed Domains)
- Web Scraping removido del catálogo de tools (de 5 a 4 tipos)
- Registros existentes de web_scraping backwards compatible (fallback Wrench icon)
- File limit indicator cuenta files + URLs juntos

---

## Resumen Acumulado del Proyecto

### Fase 0 ✓
- Monorepo npm workspaces + Turborepo
- Next.js 16 App Router + Express 5
- PostgreSQL 16 + pgvector (23 tablas, 47 índices, 6 seeds)
- 18 componentes UI con CSS Modules
- Design system verificado en /design-system

### Fase 1 ✓
- Auth custom completo (JWT + 2FA TOTP + refresh rotation + reuse detection)
- Access token en memoria, refresh token en httpOnly cookie (path: /)
- AuthContext con auto-refresh y restauración silenciosa
- Dashboard layout (sidebar + header + auth guard + mobile hamburger)
- Organization CRUD + members + sub-accounts
- Settings pages (general, team, sub-accounts, security, data)
- RLS en 8 tablas
- Logo component (Handjet Bold 700, bicolor)

### Fase 2 ✓
- Landing page con 13 secciones (CSS Modules, lucide-react, scroll reveal)
- Pricing page con toggle Monthly/Quarterly/Yearly + descuentos + feature comparison
- Blog con markdown SSG (3 posts, gray-matter + marked)
- SEO completo (metadata, JSON-LD, sitemap.ts, robots.txt, OG, Twitter cards)
- PublicNavbar (sticky + blur + mobile hamburger + auth state detection) + Footer
- Placeholder pages (Legal, About, Contact, /docs/whatsapp-setup)

### Fase 3 ✓
- Agent CRUD completo (create, read, update, delete, publish, rollback, duplicate)
- Agent editor con 5 tabs (Prompt, Variables, Tools, Settings, Versions)
- Avatar upload con fallback iniciales (multer + sharp)
- 3-5 plantillas de agentes (seeds)
- Variables editor con drag-reorder, tipos string/enum, preview de inyección LLM
- AI Prompt Generator (GPT-4o-mini meta-prompt → prompt + variables + tools sugeridas)
- 4 tool types: Custom Function (completo con test), Scheduling, Knowledge Base (files + URLs), MCP
- LLM Service multi-provider (OpenAI + Anthropic adapters, tool calling unificado)
- Plan enforcement completo (modelos, tokens, context window, tools, agentes)
- Preview/Sandbox básico (chat modal con draft prompt)
- UUID validation middleware en todas las rutas

---

## Plan Limits Implementados (spec.md sección 10)

```
                    Free        Starter     Pro         Enterprise
Agents:             1           3           10          ∞
Messages/mo:        50          1,000       5,000       25,000
Contacts:           25          500         2,000       ∞
Knowledge files:    1           5           20          ∞
Custom functions:   0           2           10          ∞
MCP servers:        0           0           3           ∞
Sub-accounts:       0           0           5           ∞
Context window:     10          15          25          50
Max tokens:         512         1,024       2,048       4,096
Channels:           Web         Web+WA      Web+WA      Web+WA
Models:             4o-mini     4o-mini+H   All         All
Human takeover:     No          Yes         Yes         Yes
BYO Key:            No          No          No          Yes
```

---

## Arquitectura Auth Actual

```
REGISTRO → bcrypt hash → create org + user → JWT tokens → cookie path=/ → redirect /dashboard + toast
LOGIN → validate → if 2FA → temp_token → verify TOTP → JWT tokens → cookie path=/
        → if no 2FA → JWT tokens → cookie path=/ → redirect /dashboard
REFRESH → validate cookie (path=/) → check reuse → rotate token → new access token
LOGOUT → invalidate refresh token → clear cookie (path=/) → redirect /login

Access Token: memoria JS (15min) | Refresh Token: httpOnly cookie path=/ sameSite=lax (7d)
Proxy (proxy.ts): verifica cookie refresh_token para /dashboard/* rutas
Páginas públicas: auth falla silenciosamente, no redirige
Rutas dinámicas: React.use(params) para Next.js 16 Promise params
```

---

## Archivos Clave Creados/Modificados en Fase 3

```
apps/api/src/
  services/agent.service.ts (full CRUD, versions, templates, duplicate)
  services/llm.service.ts (unified interface)
  services/llm/adapters/openai.adapter.ts
  services/llm/adapters/anthropic.adapter.ts
  routes/agents.ts (all agent + tool + knowledge endpoints)
  middleware/validateUUID.ts

apps/web/
  app/(dashboard)/agents/page.tsx (agent grid list)
  app/(dashboard)/agents/new/page.tsx (wizard: template/scratch)
  app/(dashboard)/agents/[id]/page.tsx (editor with 5 tabs, React.use(params))
  components/agents/AgentCard/
  components/agents/VariablesEditor/
  components/agents/PromptGenerator/
  components/agents/ToolConfigurator/ (catalog + type-specific forms)
  components/agents/CustomFunctionBuilder/
  components/agents/AvatarUploader/
  components/agents/PreviewChat/ (sandbox modal)
  components/ui/Toggle.tsx (fixed controlled/uncontrolled)

packages/shared/
  plan-limits.ts (PLAN_LIMITS with all plan values from spec)
  validators.ts (agentCreateSchema, agentUpdateSchema, variableSchema, toolSchema)
```

---

## Decisiones Tomadas en Fase 3

1. **React.use(params):** Todas las rutas dinámicas migradas a Next.js 16 Promise params pattern.
2. **UUID validation middleware:** Reutilizable, aplicado globalmente en rutas con :id.
3. **Web Scraping unificado:** Eliminado como tool separado, funcionalidad integrada en Knowledge Base.
4. **Preview básico:** Implementado como chat modal que usa draft prompt vía POST /agents/:id/preview. Funcionalidad completa (con tools, RAG, etc.) se completará en Fase 4.
5. **Plan enforcement:** Implementado en frontend (filtrar/deshabilitar) + backend (403 si excede límite).
6. **LLM Service:** OpenAI y Anthropic como adapters separados con interface unificada. BYO key support preparado para Enterprise.
7. **Knowledge files + URLs:** Ambos cuentan contra el mismo límite del plan. Status polling cada 5s. Procesamiento real (chunking/embedding) en Fase 4.
8. **Agent templates:** 3-5 seeds con prompts profesionales, variables y tools pre-configurados.

---

## Próxima Fase: FASE 4 — Motor de Conversación (Día 14-19)

### 4.1 Message Buffer
- Redis + BullMQ buffer, configurable delay per agent (default 5s)
- Aggregates multiple messages → single LLM call
- message.worker.ts: loads context (prompt + variable instructions + RAG + history within context window limit) → LLM → save response → send to channel → increment usage counter

### 4.2 Variable Capture Service
- Internal tool capture_variable registered for LLM
- Intercepts tool_call → stores in conversation.captured_variables
- Syncs to contact (base fields → columns, rest → custom_variables JSONB)
- Real-time update via WebSocket

### 4.3 RAG Pipeline
- Upload processing: extract text → chunk (500 tokens, 50 overlap) → embed (ada-002) → store pgvector
- Query: embed user message → top-5 chunks (cosine) → inject as context
- Workers: rag.worker.ts, scraping.worker.ts

### 4.4 Conversations & Chat View
- Backend: list with filters, detail with paginated messages, WebSocket for real-time
- Frontend: /conversations list + /conversations/[id] chat view (WhatsApp-style) + VariablesSidebar

### 4.5 Human Takeover
- takeover/release endpoints, pause worker, send as human
- TakeoverBanner, visual distinction AI vs human msgs
- Post-release: intervention summary for agent context

### 4.6 Preview/Sandbox (Enhancement)
- Enhance existing preview modal with tools, RAG context, variable capture
- Metadata display (tokens, tools, latency)

### Prompt para nueva conversación:
```
Soy Genner, continuamos con GenSmart. Lee spec.md, dev-plan.md y el checkpoint adjunto.
Las Fases 0, 1, 2 y 3 están completas con todos los hotfixes aplicados.
Pruebas E2E verificadas para todas las fases.
Necesito el prompt para que Claude Code ejecute la Fase 4 completa (Motor de Conversación).
```