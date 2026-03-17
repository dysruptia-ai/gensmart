# GenSmart — Checkpoint E2E Testing (Phase 12.2 + 12.3)
**Fecha:** 2026-03-11
**Estado:** E2E Testing EN PROGRESO — Bloque 1-2 completados, Bloque 4 (Human Takeover) con hotfixes pendientes
**Proyecto:** `/Users/gtproot/Projects/GenSmart/`

---

## Estado Global del Proyecto

**Fases completadas: 0, 1, 2, 3, 4, 5a, 5b, 6, 7, 8, 9, 10, 12.1**
**Fase actual: 12.2 + 12.3 combinadas (E2E Testing + Polish)**
**Fases pendientes: 12.4 (Deploy to AWS Lightsail)**

---

## Infraestructura Corriendo

```bash
# Terminal 1 — Monorepo completo
cd /Users/gtproot/Projects/GenSmart && npm run dev
# → http://localhost:3000 (Next.js — HTTP, NO HTTPS)
# → http://localhost:4000 (Express API)

# Terminal 2 — ngrok (solo si se prueba WhatsApp)
ngrok http 4000

# Terminal 3 — Stripe webhook listener
stripe listen --forward-to localhost:4000/api/billing/webhook
```

---

## Datos de Prueba

| Recurso | ID / Valor |
|---------|-----------|
| **Org principal (Pro)** | `198e98cd-aaa0-4aef-ad79-a3273c609baf` |
| Plan | Pro |
| Agente principal | `066d2687-d6b1-4d1e-a5dc-0f44255cfa37` |
| WhatsApp conectado | ✅ Phone Number ID `984048201467140` |
| **Org nueva (Free)** | Creada durante E2E, usuario `genner2@yopmail.com` |
| Agente Free | `a38da119-c8b5-4cea-bf29-f26bd7aa94e9` (Customer Support Agent) |

---

## Metodología E2E

Pruebas paso a paso: Claude guía → Genner (humano) prueba → reporta con screenshots → bugs se resuelven en el momento con hotfixes pasados a Claude Code.

---

## Resultados E2E — Lo Probado y Resultado

### Bloque 1 — Auth & Onboarding ✅ COMPLETADO
| Test | Resultado | Notas |
|------|-----------|-------|
| Registro | ✅ | Toast "Account created!", redirige a dashboard |
| Login | ✅ | Funciona correctamente |
| Logout | ✅ | Redirige a /login |
| Refresh sesión | ✅ | Cookie refresh funciona, sesión se mantiene |
| Forgot password | ✅ | Flujo OK, SMTP placeholder (`smtp.example.com`) — configurar para deploy |
| 2FA Setup | ✅ | QR code, verificación, backup codes |
| 2FA Login | ✅ | Prompt de código, verificación exitosa, acceso al dashboard |

### Bloque 2 — Agentes ✅ COMPLETADO
| Test | Resultado | Notas |
|------|-----------|-------|
| Crear agente desde template | ✅ | 6 templates disponibles, wizard funcional |
| Editor tabs (Prompt/Variables/Tools/Settings/Channels/Versions) | ✅ | Todos cargan correctamente |
| Settings | ✅ | LLM config, temperatura, max tokens, buffer, channel toggles |
| Channels | ✅ | Web Widget toggle, WhatsApp con gate de plan |
| Web Widget customizer | ✅ | Color picker, welcome message, bubble text, position, embed code, preview |
| Save | ✅ | Toast "Changes saved" |
| Preview/Sandbox | ✅ | Modal con chat funcional, "PREVIEW MODE" banner, metadata (tokens, modelo, latencia) |
| Publish | ✅ | Modal confirmación, toast "Agent published as v1", badge Draft→Active |
| Versions | ✅ | v1 visible con fecha, autor, botón Rollback |
| AI Prompt Generator | ✅ | Modal con English/Español, genera prompt + variables + tools sugeridos |
| Apply All | ✅ | Aplica prompt y variables, confirmación de reemplazo |

### Bloque 3 — Herramientas (parcial)
- Tools tab carga correctamente con "No tools configured" y botón "Add First Tool"
- **No probado aún:** Knowledge Base upload, Calendar tool, Custom Function, MCP

### Bloque 4 — Conversaciones & Widget ✅ con bugs pendientes
| Test | Resultado | Notas |
|------|-----------|-------|
| Web Widget embebido (HTML test) | ✅ | Bubble aparece, chat funcional, "Powered by GenSmart" |
| Chat con LLM (GPT-4o-mini) | ✅ | Respuestas coherentes, metadata visible |
| Variable capture | ✅ | 3 variables capturadas correctamente (patient_name, patient_email, patient_phone) |
| Conversations list | ✅ | Conversación con badge "Web" + "Active" |
| Conversation detail | ✅ | Chat view, contact sidebar, captured variables |
| Contact created | ✅ | En detalle muestra variables capturadas |
| Human Takeover — botón | ✅ | **Hotfix aplicado** (ver abajo) |
| Human Takeover — enviar msg humano | ✅ | Mensaje llega al widget via polling |
| Human Takeover — recibir msg usuario | ⚠️ | **Polling de 3s implementado**, funciona con delay |
| Human Takeover — release + AI retoma | ✅ | AI Agent resumed, intervention summary generada |
| Human Takeover — msg duplicado | 🐛 | **Hotfix pendiente** en Claude Code |
| Human Takeover — AI confunde humano/cliente | 🐛 | **Hotfix pendiente** en Claude Code |
| Widget typing indicator durante takeover | 🐛 | **Hotfix pendiente** en Claude Code |

### Bloques 5-7 — Pendientes de probar
- Funnel Kanban
- CRM detalle, AI Scoring
- Calendar
- Billing (Stripe)
- Settings (i18n es/en, GDPR)
- Dashboard analytics
- Notifications

---

## Hotfixes Aplicados Durante E2E

### Hotfix #36 — Takeover banner no detecta plan Pro
**Archivo:** `apps/web/app/dashboard/conversations/[id]/page.tsx`
**Problema:** `fetchOrgPlan` usaba `data.organization.plan` pero el endpoint `GET /api/organization` devuelve el objeto directo sin wrapper.
**Fix:** Cambiar `OrgData` interface a `{ plan: string; [key: string]: unknown }` y usar `data.plan ?? 'free'`.

### Hotfix #37 — Widget no recibe mensajes del Human Takeover
**Archivo:** `apps/web/app/widget/[agentId]/page.tsx`
**Problema:** Widget solo hacía polling cuando `pendingCount > 0`. Mensajes del humano nunca llegaban.
**Fix:** Agregar background polling de 8s que corre siempre que hay `sessionId` activo.

### Hotfix #38 — Message worker descarta mensajes durante takeover
**Archivo:** `apps/api/src/workers/message.worker.ts`
**Problema:** Step 3 hacía `return` sin guardar el mensaje del usuario cuando la conversación estaba en `human_takeover`.
**Fix:** Antes del return, guardar mensaje en BD + emitir WebSocket al dashboard.

### Hotfix #39 — WhatsApp webhook descarta mensajes durante takeover
**Archivo:** `apps/api/src/routes/whatsapp.ts`
**Problema:** Similar al #38 — cuando `convStatus === 'human_takeover'`, hacía return sin guardar.
**Fix:** Guardar mensaje en BD + notificar dashboard via WebSocket.

### Hotfix #40 — Dashboard no envía mensajes de humano por WhatsApp (stub)
**Archivo:** `apps/api/src/routes/conversations.ts`
**Problema:** El handler `POST /:id/message` tenía un stub `console.log` en vez de enviar realmente por WhatsApp.
**Fix:** Implementación real: busca whatsapp_config del agente, obtiene phone del contacto, envía via `sendTextMessage`.

### Hotfix #41 — Dashboard polling durante takeover
**Archivo:** `apps/web/app/dashboard/conversations/[id]/page.tsx`
**Problema:** WebSocket emit del worker no llegaba al dashboard (causa raíz no determinada — posible issue de rooms en Socket.IO).
**Fix:** Polling de 3s activo solo cuando conversación en `human_takeover` y el usuario actual es quien hizo el takeover.

### Hotfix #42 — Intervention summary mejorada
**Archivo:** `apps/api/src/routes/conversations.ts`
**Problema:** Prompt de intervention summary no distinguía entre humano del equipo y cliente.
**Fix:** Query incluye mensajes `user` además de `human`, formatting distingue "Team Member (staff)" vs "Customer", prompt mejorado con CRITICAL RULES.

---

## Hotfixes PENDIENTES (último prompt enviado a Claude Code, verificar resultado)

### Pendiente #43 — Mensaje humano duplicado en dashboard
**Archivo:** `apps/web/app/dashboard/conversations/[id]/page.tsx`
**Problema:** Mensaje optimístico (`id: tmp-...`) + polling trae el mismo mensaje con UUID real → duplicación.
**Fix propuesto:** Después del POST exitoso, reemplazar el ID optimístico con el real del servidor.

### Pendiente #44 — Widget typing indicator durante takeover
**Archivo:** `apps/web/app/widget/[agentId]/page.tsx`
**Problema:** `pendingCount++` muestra typing (•••) que confunde al usuario durante takeover.
**Fix propuesto:** Auto-clear timeout de 15 segundos en `handleSend`.

### Pendiente #45 — AI confunde mensajes del humano con mensajes del usuario
**Archivo:** `apps/api/src/workers/message.worker.ts`
**Problema:** En Step 7c, mensajes `human` se convierten a `role: 'user'` para el LLM. El AI ve "Soy María del equipo" como si fuera el cliente.
**Fix propuesto:** Cambiar `human` → `assistant` (no `user`) y prefijar con `[Human agent responded]:`.

---

## Bugs Conocidos (no relacionados a takeover)

### Bug — Falta toast al crear agente desde template
**Severidad:** Baja (polish)
**Archivo:** Frontend — componente de creación de agente
**Fix:** Agregar toast "Agent created successfully" después de la creación.

### Bug — "Apply All" en Prompt Generator suma variables en vez de reemplazar
**Severidad:** Media (UX confuso)
**Descripción:** Al usar Apply All, las variables sugeridas se agregan a las existentes en vez de reemplazarlas. Ej: customer_name + patient_name coexisten.

### Bug — Variables capturadas no mapean a campos base del contacto
**Severidad:** Media (feature request)
**Descripción:** Variables como `patient_name` se guardan en custom_variables pero no actualizan `contacts.name`. El CRM muestra "Name" genérico.
**Decisión:** Implementar Opción B — permitir al usuario configurar qué variable mapea a qué campo base del contacto. Diferenciador vs competidores.

### Bug — SMTP placeholder
**Severidad:** Baja (solo afecta deploy)
**Descripción:** `smtp.example.com` en `.env`. Configurar SMTP real antes de deploy.

---

## Archivos Clave Modificados en Esta Sesión

| Archivo | Hotfix | Descripción |
|---------|--------|-------------|
| `apps/web/app/dashboard/conversations/[id]/page.tsx` | #36, #41, #43* | OrgData fix, polling takeover, msg duplicado |
| `apps/web/app/widget/[agentId]/page.tsx` | #37, #44* | Background polling, typing indicator |
| `apps/api/src/workers/message.worker.ts` | #38, #45* | Guardar msg en takeover, role mapping |
| `apps/api/src/routes/whatsapp.ts` | #39 | Guardar msg en takeover |
| `apps/api/src/routes/conversations.ts` | #40, #42 | WhatsApp send real, intervention summary |

\* = pendiente de verificar resultado de Claude Code

---

## Configuración Meta / Facebook (sin cambios)

| Campo | Valor |
|-------|-------|
| App ID | `844920708591313` |
| Config ID | `1651097952681347` |
| Phone Number ID | `984048201467140` |
| WABA ID | `1256129926694982` |

---

## Prompt para Continuar E2E en Nueva Conversación

```
Estoy trabajando en GenSmart (SaaS de agentes IA para WhatsApp/Web).
Proyecto en: /Users/gtproot/Projects/GenSmart/

ESTADO: E2E Testing en progreso. Fases 0-10, 5b y 12.1 completadas.
Realizando Phase 12.2 + 12.3 combinadas (E2E + Polish).

INFRAESTRUCTURA:
- Frontend: http://localhost:3000 (Next.js — HTTP, NO HTTPS)
- API: http://localhost:4000 (Express)
- Comando: cd /Users/gtproot/Projects/GenSmart && npm run dev

CONTEXTO INMEDIATO:
El último prompt enviado a Claude Code contenía 3 hotfixes pendientes:
1. Mensaje humano duplicado en dashboard (optimistic msg + polling)
2. Widget typing indicator durante takeover (auto-clear 15s)
3. AI confunde mensajes del humano con el usuario (human→assistant role)

NECESITO:
1. Verificar si Claude Code aplicó los 3 hotfixes correctamente
2. Re-probar Human Takeover completo (flujo: takeover → msg humano → 
   msg usuario → release → AI retoma sin confusión)
3. Continuar E2E con los bloques restantes:
   - Funnel Kanban
   - CRM + AI Scoring
   - Calendar
   - Billing (Stripe checkout + usage)
   - Settings (i18n, GDPR export/delete)
   - Dashboard analytics
   - Notifications

METODOLOGÍA: Paso a paso — Claude guía, yo (humano) pruebo y reporto
con screenshots. Bugs se resuelven inmediatamente con hotfixes.

Lee el checkpoint adjunto para contexto completo de lo probado,
los hotfixes aplicados, y los bugs pendientes.

CONVENCIONES:
- Monorepo npm workspaces + Turborepo
- CSS Modules (sin Tailwind), lucide-react icons
- Custom JWT auth (NO NextAuth)
- Paleta beige/verde WhatsApp
- Logo: components/ui/Logo/Logo.tsx — "Gen" negro + "Smart" verde, Handjet Bold 700
- Human Takeover DEBE probarse con cuenta Pro (org 198e98cd)
```