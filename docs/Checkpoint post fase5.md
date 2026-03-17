# GenSmart — Checkpoint Post-Fase 5 (2026-02-26)

> **Para:** Continuación en nueva conversación con Claude  
> **Proyecto:** `/Users/gtproot/Projects/GenSmart/`  
> **Documentos base:** spec.md y dev-plan.md en la raíz del proyecto

---

## Estado General

**Fases completadas:** 0, 1, 2, 3, 4, 5  
**Próxima fase:** 6 — CRM + Funnel + AI Scoring  
**Hotfixes aplicados:** #1 al #11

---

## Qué está funcionando (verificado end-to-end)

### Fase 0-2: Fundación + Auth + Landing
- Monorepo npm workspaces + Turborepo
- PostgreSQL 16 + pgvector + Redis + BullMQ
- Design system completo (CSS Modules, Inter, paleta beige/verde)
- Auth custom JWT (registro, login, refresh, logout, 2FA TOTP, backup codes)
- Landing page, pricing, blog
- Multi-tenancy + team management + sub-accounts

### Fase 3: Agentes AI Core
- CRUD de agentes con editor completo (tabs: Prompt, Variables, Tools, Settings, Channels, Versions)
- Variables editor con drag-reorder
- AI Prompt Generator (meta-prompt → system prompt + variables sugeridas)
- Tool Configurator (Custom Functions, RAG file upload/URL, Scheduling placeholder, MCP placeholder)
- Plan enforcement en models, tools, knowledge files
- Agent versioning + publish + rollback
- Avatar upload con fallback iniciales
- Agent duplicate

### Fase 4: Motor de Conversación
- Message Buffer: Redis + BullMQ, agrupa mensajes rápidos (default 5s) → 1 LLM call
- Variable Capture: tool interno capture_variable → conversations.captured_variables → sync parcial a contacts
- LLM Service: OpenAI + Anthropic multi-provider, tool calling unificado
- Preview/Sandbox: chat en el editor, historia en Redis, tools + RAG activos, no afecta counters
- Conversations list + chat view con WebSocket real-time
- Human Takeover: banner visible, gated por plan (Free no tiene acceso)
- RAG Pipeline: upload archivos → chunks → embeddings pgvector → query cosine similarity
- Custom Function execution: body template, auth, response mapping, test endpoint

### Fase 5: Canales — WhatsApp + Web Widget
- **Web Widget:**
  - widget.js loader (<20KB) → inyecta iframe
  - Mini-app React standalone con polling, typing indicator, color dinámico
  - Fire-and-forget input (múltiples mensajes sin bloquear)
  - Session persistence via localStorage
  - "Powered by GenSmart" footer
  - Widget Customizer: color, welcome message, bubble text, posición, preview en vivo
  - Embed code snippet con botón copiar
  - Rate limiting: endpoints públicos sin auth
- **WhatsApp:**
  - Webhook verification + message handling con HMAC-SHA256
  - whatsapp.service: sendTextMessage, markAsRead, encrypt/decrypt access token
  - Embedded Signup OAuth flow (Facebook SDK)
  - Manual setup UI
  - Plan gate: Free plan → 403 en todos los endpoints WhatsApp
  - Message worker envía respuestas via Meta Cloud API v21.0
- **Channel Toggle:** Auto-save inmediato al activar/desactivar
- **Usage Counter:** Redis `usage:{orgId}:{YYYY-MM}:messages` — conteo correcto

---

## Bugs Resueltos (Hotfixes #1-#10)

| Hotfix | Descripción |
|--------|------------|
| #1 | Sidebar mobile responsive, team invite email focus, 2FA disable |
| #2 | Auth flow bugs (registro, login, refresh) |
| #3 | Landing page responsive issues |
| #4 | Agent editor save/publish flow |
| #5 | Variables editor drag-reorder |
| #6 | Tool configurator plan enforcement |
| #7 | Preview chat tool calls |
| #8 | Conversation list + chat view |
| #8b | Knowledge file upload + RAG processing |
| #9 | Widget toggle channel persistence (auto-save) |
| #10 | Widget fire-and-forget input + dirty banner |

### Bugs adicionales resueltos durante Fase 5 testing:
- Express 5 CORS wildcard `*` crash (`PathError`) → `router.use(cors())` 
- CSS Module selector `*` not pure → `:global(*)` wrapper
- WidgetCustomizer PUT solo enviaba webConfig sin channels → ahora incluye channels
- toggleChannel no hacía auto-save → ahora hace PUT inmediato

---

## Bugs Conocidos Pendientes (no bloquean Fase 6)

1. **Variable sync parcial:** `user_name` capturado no se mapea a `contacts.name`. El variable-capture.service mapea campos base (name, phone, email) pero las variables del agente pueden tener nombres diferentes (user_name vs name). Se afina en Fase 6 con el CRM.

2. **Knowledge files huérfanos:** Si se sube un archivo/URL al RAG y luego se cancela la creación del tool, los registros en knowledge_files y knowledge_chunks persisten sin tool asociado. Necesita cleanup job.

3. **Contacts page placeholder:** Dice "CRM coming in Phase 6" — correcto según dev-plan.

4. **Funnel page placeholder:** Similar a contacts.

5. **PDF parsing falla:** `pdfParse is not a function` en el RAG worker. La dependencia pdf-parse no está instalada correctamente o el import es incorrecto. El archivo se sube (knowledge_files row con status='error', error_message='pdfParse is not a function'), pero nunca se procesa. DOCX y MD/TXT sí funcionan. Fix: verificar `npm ls pdf-parse` en apps/api, revisar el import en el RAG worker (puede necesitar `import pdfParse from 'pdf-parse'` vs `require`).

6. **Tool toggle (is_enabled) no persiste:** ~~RESUELTO en Hotfix #11~~ — `getTools()` retornaba rows crudos sin `formatTool()`. Ahora transforma snake_case → camelCase.

7. **RAG no inyecta contexto en conversaciones:** El knowledge_chunks tiene datos correctos (embeddings generados, status='ready', contenido verificado). Pero ni el Preview ni el Widget usan el contexto RAG al responder. El `hasKnowledgeBase()` retorna true (verifica `knowledge_files.status='ready'`), pero `queryKnowledgeBase()` probablemente falla silenciosamente en `generateEmbedding()` (el catch retorna `''`). 
   - **Datos de prueba:** `codigos.md` con contenido `genner -> 7611, nilson -> 3456, lina -> 2345`
   - **Diagnóstico pendiente:** Agregar `console.log` en `queryKnowledgeBase` y `generateEmbedding` para ver dónde falla. Verificar que `OPENAI_API_KEY` está configurada y que `text-embedding-ada-002` responde correctamente. El error puede ser: (a) embedding del query falla, (b) la query SQL con `<=>` operator falla, (c) pgvector extension no está habilitada.
   - **Archivo:** `apps/api/src/services/rag.service.ts` — `queryKnowledgeBase()` tiene try/catch que retorna `''` en error silencioso.

---

## Stack Técnico Confirmado

- Next.js 16 (App Router) + Express.js 5 + TypeScript
- PostgreSQL 16 + pgvector + Redis 7 + BullMQ
- CSS Modules (NO Tailwind), lucide-react, Inter font
- Custom JWT auth (access token en memoria, refresh en httpOnly cookie)
- OpenAI (gpt-4o-mini default) + Anthropic (Claude Haiku/Sonnet)
- Zod validation, monorepo packages/shared
- WebSocket (socket.io) para real-time

---

## Estructura de Base de Datos Activa

Tablas con datos:
- organizations, users, refresh_tokens (auth)
- agents, agent_versions, agent_tools (agentes)
- knowledge_files, knowledge_chunks (RAG)
- conversations, messages (conversaciones)
- contacts (CRM — creados automáticamente, pendiente UI)
- usage_logs (billing tracking)

Tablas creadas pero vacías:
- calendars, appointments (Fase 7)
- billing_events (Fase 8)
- notifications (Fase 9)
- sub_accounts, backup_codes, password_resets
- data_export_requests, account_deletion_requests (GDPR, Fase 10)

---

## Variables de Entorno Configuradas

- DATABASE_URL, REDIS_URL
- JWT_SECRET, JWT_REFRESH_SECRET, ENCRYPTION_KEY
- OPENAI_API_KEY (requerida para LLM)
- ANTHROPIC_API_KEY (opcional)
- WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN, FACEBOOK_APP_ID, FACEBOOK_APP_SECRET (opcionales)
- NEXT_PUBLIC_API_URL=http://localhost:4000
- NEXT_PUBLIC_APP_URL=http://localhost:3000

---

## Datos de Prueba en BD

- **Organización:** Genner Puello (plan: free, org_id: 198e98cd-aaa0-4aef-ad79-a3273c609baf)
- **Agente:** "Agente de Prueba" (id: 066d2687-d6b1-4d1e-a5dc-0f44255cfa37, status: active, model: gpt-4o-mini, channels: ["web"])
- **Conversaciones:** 2+ del widget testing
- **Contactos:** 1+ creado automáticamente (name: NULL, tiene custom_variables)
- **Usage:** 2+ mensajes contados en Redis para 2026-02

## Diagnóstico Pendiente para Próxima Sesión

### RAG no inyecta contexto (Bug #7 — Prioridad Alta)
El RAG pipeline almacena correctamente (upload → chunk → embed → pgvector) pero no inyecta 
al responder. Pasos de diagnóstico:

1. Agregar `console.log` al inicio de `queryKnowledgeBase()` en `apps/api/src/services/rag.service.ts`:
   ```typescript
   console.log('[rag] queryKnowledgeBase called for agent:', agentId);
   ```
2. Agregar `console.log` después de `generateEmbedding`:
   ```typescript
   const embedding = await generateEmbedding(userMessage);
   console.log('[rag] embedding length:', embedding.length);
   ```
3. Agregar `console.log` después de la query SQL:
   ```typescript
   console.log('[rag] chunks found:', result.rows.length);
   ```
4. Verificar que el Preview endpoint (`POST /api/agents/:id/preview`) también llama a RAG. 
   Buscar en `apps/api/src/routes/agents.ts` el handler de preview.
5. Si `generateEmbedding` retorna `[]`, el problema es la API key de OpenAI o el modelo 
   `text-embedding-ada-002`.

### PDF parsing (Bug #5)
Verificar si Hotfix #11 resolvió el import de pdf-parse. Si no, revisar el import en 
`apps/api/src/workers/rag.worker.ts`.

---

## Próxima Fase: 6 — CRM + Funnel + AI Scoring

### 6.1 CRM (Contacts)
- Backend: CRUD con filtros, paginación, búsqueda, CSV export
- AI Scoring: después de cerrar conversación → LLM extrae summary, score, service, variables → update contact
- Frontend:
  - /contacts → tabla (name, phone, email, agent, ScoreBadge, funnel stage, service, date)
  - /contacts/[id] → header, AI summary, variables, conversations, timeline, notes, funnel stage editor

### 6.2 Funnel Kanban
- Backend: contacts agrupados por stage, stats, move
- Frontend: /funnel → 3 columnas (Lead | Opportunity | Customer), drag-drop, counters, metrics, agent filter

### 6.3 AI Scoring Worker
- scoring.worker.ts: trigger on conversation close o N mensajes
- LLM prompt → extract summary, score 0-10, service, variables → update contact
- Auto-move funnel stage basado en score (configurable)
- Botón manual "Re-analyze" en dashboard

### Integración con lo existente
- Los contacts ya se crean automáticamente desde el widget/message worker
- Las variables ya se capturan en conversations.captured_variables
- Falta: sincronizar captured_variables correctamente a contacts.name/phone/email/custom_variables
- Falta: UI completa del CRM y Funnel (actualmente son placeholders)

---

## Instrucciones para Claude Code

```
Lee spec.md y dev-plan.md en la raíz del proyecto.
Lee este checkpoint para contexto del estado actual.
Ejecuta la Fase 6 completa (CRM + Funnel + AI Scoring).
Sigue las tareas en orden. Verifica que cada tarea funciona antes de avanzar.
CSS Modules, lucide-react, paleta de colores del spec.
Git commit al final de cada sub-fase.

IMPORTANTE:
- La página /contacts actualmente es un placeholder "CRM coming in Phase 6" — reemplazarla
- La página /funnel actualmente es un placeholder — reemplazarla
- Los contacts ya se crean desde el message worker — no duplicar lógica
- El variable-capture.service necesita mejorar el mapeo: user_name→name, user_email→email, etc.
- La tabla contacts ya existe con todos los campos del spec
- Plan enforcement: check limits de contactos por plan (Free: 25, Starter: 500, Pro: 2000, Enterprise: unlimited)
```

---

## Logo GenSmart
components/ui/Logo/Logo.tsx — Handjet Bold 700, bicolor "Gen" negro + "Smart" verde.
Incluir en todos los prompts de fases futuras.