# GenSmart — Checkpoint Post-Fase 4

> **Fecha:** 2026-02-26
> **Estado:** FASE 0 ✓ + FASE 1 ✓ + FASE 2 ✓ + FASE 3 ✓ + FASE 4 ✓ (2 bugs pendientes) + HOTFIXES #1-#7 ✓
> **Pruebas E2E:** Fase 1 ✓ + Fase 2 ✓ + Fase 3 ✓ + Fase 4 parcial (ver sección "Estado de Pruebas E2E Fase 4")
> **Próxima fase:** Fase 5 — Canales: WhatsApp + Web Widget
> **Pendiente antes de Fase 5:** Hotfix #8 para 2 bugs persistentes (BUG-042 file upload, BUG-044 plan enforcement)

---

## Fase 4 — Motor de Conversación — Completada ✓ (con hotfixes en progreso)

### Commits realizados:
```
[fase4]    b656d81 feat: Phase 4 complete — message buffer, variable capture, RAG pipeline, conversations, human takeover, enhanced preview
[fase4]    7ab97ef (second commit from Phase 4 execution)
[hotfix4]  fix: guard calendars undefined in ToolConfigurator scheduling panel (TypeError crash)
[hotfix5]  fix: resolve 7 Phase 4 E2E bugs (RAG processing, preview tools/RAG, chat UI, KB flow)
[hotfix6]  fix: plan enforcement for tools, RAG file processing, KB UI polling, preview input non-blocking
[hotfix7]  fix: KB file upload pipeline, KB status polling UI refresh, plan enforcement for tool catalog (PARCIAL — 1 de 3 bugs resuelto)
```

### Resultado Hotfix #7:
- **BUG-042 (file upload):** ❌ PERSISTE — el frontend NO llama al endpoint de upload. Al seleccionar archivo y guardar, no se hace POST al backend. Ni siquiera aparece request en Network tab. 4 intentos de fix fallidos.
- **BUG-043-UI (polling status):** ✅ RESUELTO — URLs procesadas ahora muestran "Ready · 1 chunks" correctamente en la UI con badge verde.
- **BUG-044 (plan enforcement):** ❌ PERSISTE — Starter y Pro users siguen viendo "Upgrade" badge en Custom Functions. MCP también muestra "Upgrade" para Pro (debería estar habilitado). 3 intentos de fix fallidos.

### Sub-fase 4.1 — Message Buffer + Message Worker ✓
- **config/queues.ts:** BullMQ queue setup (message-processing, rag-processing, scraping-processing, ai-scoring) with dedicated IORedis connections (maxRetriesPerRequest: null)
- **config/websocket.ts:** Socket.IO server with JWT auth middleware, org rooms + conversation rooms
- **services/message-buffer.service.ts:** Redis RPUSH buffer + delayed BullMQ job with timer reset
- **services/usage.service.ts:** Redis INCR counters with TTL 35 days, plan limit check
- **services/custom-function.service.ts:** HTTP executor with body template interpolation, auth (Bearer/API key), response mapping, timeout
- **workers/message.worker.ts:** Full pipeline — flush buffer → check takeover/limits → build context (system prompt + variable instructions + RAG + history) → LLM tool loop (max 5 iterations) → save messages → increment usage → emit WebSocket → send to channel (WhatsApp stub)
- **NOTA:** El message buffer y worker NO se pudieron testear E2E porque requieren conversaciones reales (Web Widget o WhatsApp). Se testearán en Fase 5.

### Sub-fase 4.2 — Variable Capture Service ✓
- **services/variable-capture.service.ts:** Auto-generates capture instructions injected into system prompt, capture_variable tool definition, handles captures (JSONB update), syncs name/email/phone to contacts, auto-creates contacts, emits variables:update WebSocket event
- **Funciona en Preview:** Variables se capturan correctamente en el preview (verificado con imagen — user_name: "Virginia", user_email: "viyo@yopmail.com")
- **Sync a BD:** NO testeado — Preview no crea datos reales en BD. Se testeará con conversaciones reales en Fase 5.

### Sub-fase 4.3 — RAG Pipeline ✓ (con bugs en file upload)
- **services/rag.service.ts:** pgvector cosine query (embedding <=> $2::vector), text chunking (~500 tokens with overlap), batch embedding storage
- **workers/rag.worker.ts:** Processes .pdf (pdf-parse), .docx (mammoth), .txt/.md files
- **workers/scraping.worker.ts:** Cheerio web scraper, strips nav/footer/scripts, extracts main content
- **routes/agents.ts:** Enqueues RAG/scraping jobs after knowledge upload/reprocess
- **URL scraping:** FUNCIONA ✓ — URL se scrapea, chunks se crean en BD, embeddings generados
- **File upload:** BUG PERSISTENTE — archivos seleccionados aparecen en UI pero no se suben al backend (Hotfix #7 en ejecución)
- **RAG en Preview:** Parcialmente funcional — depende de que los archivos se procesen correctamente
- **Dependencias instaladas:** pdf-parse, mammoth, cheerio en apps/api

### Sub-fase 4.4 — Conversations & Chat View ✓
- **routes/conversations.ts:** Full REST API — list with filters/pagination, detail with messages, create, send message, takeover, release, close
- **ConversationsPage:** Searchable/filterable list with real-time WebSocket updates
- **ConversationDetailPage:** 3-column layout, live message streaming, scroll-to-bottom
- **MessageBubble:** Role-based styling (user/assistant/human/system), metadata pill for assistant messages
- **TakeoverBanner:** AI/takeover/closed states, plan-gated upgrade link for Free plan
- **VariablesSidebar:** Contact info + captured variables with required/optional indicators
- **useWebSocket hook:** socket.io-client, typed events, auto-reconnect
- **NOTA:** No testeado E2E — sin conversaciones reales hasta Fase 5. Empty state verificado ✓

### Sub-fase 4.5 — Human Takeover ✓
- Takeover endpoint with plan enforcement (Free = 403)
- Release with LLM-generated intervention summary saved as system message
- **NOTA:** No testeado E2E — requiere conversaciones reales

### Sub-fase 4.6 — Enhanced Preview ✓
- Redis-persistent conversation history (TTL 30 min)
- Full tools + RAG + variable capture pipeline en preview
- Metadata response (tokens/latency/tools/model)
- /preview/reset endpoint
- Frontend metadata pills + captured variables section
- **Chat UI:** Burbujas estilo WhatsApp (user derecha verde, assistant izquierda blanco) ✓
- **Input non-blocking:** El input ya NO se bloquea mientras espera respuesta del AI ✓ (fire-and-forget pattern)
- **Tool calls en metadata:** Se muestran con icono 🔧 Wrench en metadata pill ✓

---

## Hotfixes Aplicados (Fase 4)

### Hotfix #4 — ToolConfigurator Scheduling Panel Crash ✓
- **BUG:** TypeError "Cannot read properties of undefined (reading 'length')" en renderSchedulingPanel
- **Fix:** Guard `(!calendars || calendars.length === 0)` + estado inicial `useState<any[]>([])`

### Hotfix #5 — 7 Bugs E2E Fase 4 ✓
- **BUG-040:** Preview chat UI — burbujas estilo WhatsApp (user derecha, assistant izquierda) ✓
- **BUG-041:** Preview input focus después de enviar (parcial — resuelto completamente en Hotfix #6) ✓
- **BUG-042:** Knowledge files upload → RAG worker enqueue (parcial — raíz no resuelta, Hotfix #7) ⚠️
- **BUG-043:** Preview RAG context — era consecuencia de BUG-042, ya implementado en backend ✓
- **BUG-044:** Preview custom functions — ya implementado en backend ✓
- **BUG-045:** Metadata pill muestra tools llamadas con icono Wrench ✓
- **BUG-046:** KB creation flow — upload zone visible al crear (sin save-first-then-edit) ✓

### Hotfix #6 — 4 Bugs Persistentes ✓
- **BUG-041:** Preview input fire-and-forget, previewPending counter, nunca disabled ✓
- **BUG-042:** ragQueue/scrapingQueue error handling mejorado (parcial — file upload aún no funciona) ⚠️
- **BUG-043-UI:** loadKnowledgeFiles polling every 5s sin hasProcessing guard ✓
- **BUG-044:** orgPlanLoaded state para evitar flash de plan 'free' default (parcial — no resolvió) ⚠️

### Hotfix #7 — Resultados Parciales (1 de 3 resuelto)
- **BUG-042 (4to intento):** ❌ PERSISTE — File upload no funciona. El frontend NO hace POST al endpoint `/api/agents/:id/knowledge` al guardar. El archivo se selecciona y aparece en la lista UI pero al hacer clic en "Add Tool" o "Save Changes" no se envía al backend. No aparece ningún request de knowledge upload en Network tab. Esto necesita debugging directo del código — Claude Code debe leer el handleSave() y rastrear exactamente por qué no ejecuta el upload.
- **BUG-043-UI (2do intento):** ✅ RESUELTO — URL scraping ahora muestra status correcto: "Ready · 1 chunks" con badge verde y checkmark. Polling funciona correctamente.
- **BUG-044 (3er intento):** ❌ PERSISTE — Starter User (imagen 3) y Pro User (imagen 4) siguen viendo "Upgrade" badge en Custom Functions. Pro User también ve "Upgrade" en MCP Server. El componente ToolConfigurator no está recibiendo el plan correcto o la lógica de evaluación del badge sigue defaulteando a 'free'. Necesita debugging directo: console.log del plan recibido en ToolConfigurator.

---

## Estado de Pruebas E2E Fase 4

### ✅ Verificado y Funcional
- Workers inician correctamente (message, rag, scraping) + Redis connected + WebSocket ready
- Preview: envío de mensajes, respuestas AI, metadata pill (tokens, latencia, modelo)
- Preview: burbujas estilo WhatsApp (user derecha verde, assistant izquierda blanco)
- Preview: input fire-and-forget (enviar múltiples mensajes sin bloqueo)
- Preview: variable capture funciona (nombre, email, enum values se capturan correctamente)
- Preview: captured variables se muestran en sección inferior del chat
- Preview: reset limpia historial
- Preview: publish funciona (nueva versión)
- Preview: banner "PREVIEW MODE — Messages are not counted" visible
- Preview: no crea conversations/messages/contacts en BD (sandbox aislado) ✓
- Knowledge Base URL scraping: URL se procesa → chunks en BD con embeddings ✓
- Knowledge Base: límites de plan (Documents: X/Y) se reflejan correctamente ✓
- Knowledge Base: file limit reached bloquea uploads ✓
- Conversations page: empty state funcional ✓

### ⚠️ 2 Bugs Pendientes (requieren Hotfix #8)
- **BUG-042 (file upload):** CRÍTICO — Archivos seleccionados en Knowledge Base NO se suben al backend. Frontend no hace POST. 4 intentos de fix fallidos. El próximo intento debe: 1) leer el código real de handleSave(), 2) agregar console.log, 3) verificar en Network tab, 4) arreglar basado en evidencia.
- **BUG-044 (plan enforcement tools):** CRÍTICO — Starter y Pro users ven "Upgrade" en Custom Functions y MCP. 3 intentos de fix fallidos. El próximo intento debe: 1) console.log del plan en ToolConfigurator, 2) verificar PLAN_LIMITS values, 3) rastrear de dónde viene el plan prop.

### ❌ No Testeable Hasta Fase 5 (requiere Web Widget / WhatsApp)
- Message buffer: acumulación de mensajes rápidos y envío como batch al LLM
- Message worker: pipeline completo (buffer → context → LLM → save → channel → usage counter)
- Usage counters en Redis (no se crean en preview)
- Variable capture: sync a BD (contacts.name/email/phone, custom_variables)
- Variable capture: auto-creación de contacto
- Conversations list: filtros, paginación, búsqueda con datos reales
- Chat view: mensajes reales con roles distintos, auto-scroll, load more
- WebSocket real-time: updates en lista y chat view
- Human takeover: take/release/intervention summary/plan enforcement
- VariablesSidebar: actualización real-time en conversación
- Custom function execution: en contexto de conversación real (funciona en preview)

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

### Fase 4 ✓ (con hotfixes pendientes)
- Message buffer + BullMQ workers (message, RAG, scraping, scoring queues)
- WebSocket server (Socket.IO) con JWT auth y org/conversation rooms
- Variable capture service (capture_variable tool, contact sync, auto-create)
- RAG pipeline (file processing, web scraping, embeddings, pgvector query)
- Custom function executor (HTTP calls, body templates, response mapping)
- Usage counters en Redis (INCR con TTL 35 días)
- Conversations REST API (list, detail, create, send, takeover, release, close)
- Chat view (3-column layout, message bubbles by role, variables sidebar)
- Human takeover (take/release, intervention summary, plan enforcement)
- Enhanced preview (tools, RAG, variables, metadata, fire-and-forget input)

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

## Usuarios de Prueba

```
Usuario existente (Free plan):
  Email: (el email original del registro)
  Plan: free

Seed de prueba:
  starter@test.com / Test1234! → Plan: starter
  pro@test.com / Test1234! → Plan: pro
  enterprise@test.com / Test1234! → Plan: enterprise
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

## Archivos Clave Creados/Modificados en Fase 4

```
CREADOS:
apps/api/src/
  config/queues.ts (BullMQ queues: message-processing, rag-processing, scraping-processing, ai-scoring)
  config/websocket.ts (Socket.IO server, JWT auth, rooms)
  services/message-buffer.service.ts (Redis buffer + delayed jobs)
  services/variable-capture.service.ts (capture tool, contact sync)
  services/custom-function.service.ts (HTTP executor, body templates)
  services/rag.service.ts (pgvector query, chunking, embeddings)
  services/usage.service.ts (Redis counters, plan limits)
  workers/message.worker.ts (full conversation pipeline)
  workers/rag.worker.ts (file processing: pdf-parse, mammoth, txt/md)
  workers/scraping.worker.ts (cheerio web scraper)
  routes/conversations.ts (full REST API)

apps/web/
  app/(dashboard)/conversations/page.tsx (conversation list)
  app/(dashboard)/conversations/[id]/page.tsx (chat view, 3-column)
  components/conversations/ConversationList/
  components/conversations/ChatView/
  components/conversations/MessageBubble/ (role-based WhatsApp-style bubbles)
  components/conversations/TakeoverBanner/ (AI/human/closed states)
  components/conversations/VariablesSidebar/ (contact + captured variables)
  hooks/useWebSocket.ts (socket.io-client, typed events)
  hooks/useConversations.ts

MODIFICADOS:
  apps/api/src/routes/agents.ts (knowledge upload → RAG/scraping enqueue)
  apps/api/src/services/llm.service.ts (tool call loop integration)
  apps/web/components/agents/PreviewChat/ (enhanced: tools, RAG, metadata, fire-and-forget, WhatsApp bubbles)
  apps/web/components/agents/ToolConfigurator/ (KB file upload in create flow, polling, plan enforcement)
  packages/shared/plan-limits.ts (customFunctions, mcpServers values verified)
```

---

## Dependencias Instaladas en Fase 4

```
apps/api:
  socket.io, pdf-parse, mammoth, cheerio, bullmq (verificar si bullmq ya existía de Fase 0)

apps/web:
  socket.io-client
```

---

## Decisiones Tomadas en Fase 4

1. **Preview es sandbox aislado:** No crea conversations/messages/contacts en BD. Usa Redis temporal (TTL 30 min). No afecta usage counters. Variable capture solo en memoria del preview.
2. **RAG no es tool visible:** RAG inyecta contexto automáticamente en el system prompt, no es un tool_call que el LLM invoca. El LLM recibe la info como "KNOWLEDGE BASE CONTEXT:" y la usa naturalmente.
3. **Message buffer no aplica a preview:** Preview hace llamadas directas al LLM sin pasar por el buffer. El buffer es para conversaciones reales (canales).
4. **WhatsApp stub:** El message worker tiene un stub para envío WhatsApp que loguea sin fallar. Implementación real en Fase 5.
5. **AI Scoring stub:** Al cerrar conversación, se encola job en ai-scoring queue. Worker real en Fase 6.
6. **Calendar tools stub:** check_availability y book_appointment registrados como tools pero retornan respuestas mock. Implementación real en Fase 7.
7. **Fire-and-forget pattern en Preview:** Input no se bloquea mientras espera respuesta. User messages se agregan al chat inmediatamente. La respuesta AI se append cuando llega.

---

## Próxima Fase: FASE 5 — Canales: WhatsApp + Web Widget (Día 20-25)

### Antes de iniciar Fase 5:
1. Ejecutar Hotfix #8 para resolver BUG-042 (file upload) y BUG-044 (plan enforcement tools)
2. **ESTRATEGIA PARA HOTFIX #8:** Los prompts descriptivos no han funcionado después de 3-4 intentos. El siguiente intento debe pedir a Claude Code que PRIMERO lea el código actual de handleSave() en ToolConfigurator.tsx y el plan prop chain, LUEGO diagnostique, LUEGO arregle. Approach: "Lee el archivo, muéstrame qué hace, y arréglalo" en vez de "haz estos cambios".
3. Verificar ambos bugs
4. Una vez resueltos, generar prompt de Fase 5

### 5.1 WhatsApp Integration
- Backend: Webhook verification (GET) + message handling (POST) with signature validation
- whatsapp.service.ts: send text, mark as read
- Embedded Signup callback endpoint
- Connect endpoint + status check
- Frontend: /agents/[id]/channels — Embedded Signup flow, manual setup guide, connection status

### 5.2 Web Widget
- widget.js (<20KB minified): inject iframe, read data-agent-id, bubble + chat panel
- Widget mini-app (React, in iframe): branded chat, session persistence
- Backend: public endpoints (CORS *), session management, SSE/polling for messages
- Frontend dashboard: WidgetCustomizer, live preview, code snippet
- Rate limiting: 30 msgs/session, invisible CAPTCHA, IP blocking

### IMPORTANTE para Fase 5:
Con el Web Widget funcionando, se podrán testear E2E TODAS las features de Fase 4:
- Message buffer (mensajes rápidos → batch al LLM)
- Variable capture con sync a BD (contacts)
- Usage counters en Redis
- Conversations list y chat view con datos reales
- WebSocket real-time updates
- Human takeover completo
- RAG en conversaciones reales

### Prompt para nueva conversación:
```
Soy Genner, continuamos con GenSmart. Lee spec.md, dev-plan.md y el checkpoint adjunto.
Las Fases 0, 1, 2, 3 y 4 están completas.
Hotfixes #1-#7 aplicados.

HAY 2 BUGS PERSISTENTES que NO se han podido resolver en 3-4 intentos con prompts descriptivos:
- BUG-042: Knowledge Base file upload — archivos seleccionados NO se suben al backend al guardar. El frontend no hace POST.
- BUG-044: Plan enforcement en ToolConfigurator — Starter y Pro users ven "Upgrade" badge en Custom Functions y MCP incorrectamente.

ESTRATEGIA: Los prompts anteriores describían el fix esperado pero Claude Code no encontraba la causa raíz.
Para el Hotfix #8, necesito que Claude Code:
1. LEA el código actual de ToolConfigurator.tsx (handleSave function y plan prop chain)
2. DIAGNOSTIQUE exactamente por qué no funciona (con console.logs si es necesario)
3. ARREGLE basado en evidencia del código real

Después de resolver estos bugs, necesito el prompt para Fase 5 (Canales: WhatsApp + Web Widget).
```

---

## GenSmart Logo
- **Componente:** components/ui/Logo/Logo.tsx
- **Font:** Handjet Bold 700
- **Estilo:** Bicolor — "Gen" en negro + "Smart" en verde (--color-primary)
- **Incluir en todos los prompts de fases futuras**