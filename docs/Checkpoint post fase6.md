# GenSmart — Checkpoint Post Fase 6 + Hotfix #13

> **Fecha:** 2026-02-28
> **Proyecto:** `/Users/gtproot/Projects/GenSmart/`
> **Conversación anterior:** Testing E2E Fase 6 + Hotfix #13
> **Próximo paso:** Aplicar Hotfix #13b → re-test delete → preparar Fase 7

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
| 6 — CRM + Funnel + AI Scoring | ✅ Completa | 3 commits: 9e16c3b, 7f482b7, ef7eb73 |

### Hotfixes aplicados:
| Hotfix | Commit | Descripción |
|--------|--------|-------------|
| #1-#11 | Varios | Pre-Fase 6 (ver checkpoint anterior) |
| #12 | — | PDF parsing v2, RAG context injection, variable sync mapping |
| #12b | — | Strengthen RAG context priority in LLM prompts |
| #13 | 42bd8aa | Delete button, real-time refresh, clean custom_variables nulls, agent column fix |
| **#13b** | **PENDIENTE** | **Fix delete contact FK constraint** |

---

## 2. Hotfix #13b — PENDIENTE (Aplicar primero)

### Problema:
`DELETE /api/contacts/:id` retorna 500 con error:
```
violates foreign key constraint "conversations_contact_id_fkey" on table "conversations"
Key (id)=(225d2418-d608-4189-86a5-4eb3552a1dc3) is still referenced from table "conversations"
```

### Fix:
En `apps/api/src/services/contact.service.ts` — función `deleteContact`, antes de eliminar el contacto, desvincular las conversaciones:

```typescript
export async function deleteContact(orgId: string, contactId: string): Promise<boolean> {
  // First, unlink conversations (set contact_id to NULL instead of deleting them)
  await query(
    'UPDATE conversations SET contact_id = NULL WHERE contact_id = $1 AND organization_id = $2',
    [contactId, orgId]
  );
  
  // Then delete the contact
  const result = await query(
    'DELETE FROM contacts WHERE id = $1 AND organization_id = $2',
    [contactId, orgId]
  );
  
  return (result.rowCount ?? 0) > 0;
}
```

Commit: `"Hotfix #13b: Fix delete contact FK constraint — unlink conversations before delete"`

### Después de aplicar, re-testear:
1. Ir a un contacto "Unknown" → click Delete → confirmar → debe eliminar y redirect a /dashboard/contacts
2. Verificar que la lista muestra un contacto menos

---

## 3. Resultados E2E Testing Fase 6

### ✅ Todo funcionando:
- **Contacts list:** Tabla con 7 contactos, paginación, filtros (search, agent, stage, score)
- **Filtro search:** "genner" → 2 resultados
- **Filtro stage:** "Opportunity" → 1 resultado (Vito teran)
- **Filtro score:** "Medium (4-6)" → 2 resultados
- **Export CSV:** Descarga correcta con columnas name, phone, email, agent, score, stage, service, source, created_at
- **Contact detail:** 2 columnas, header con avatar/score/stage/channel, AI Analysis, Notes, Conversations, Variables, Timeline
- **Stage change:** Dropdown funciona, actualiza BD
- **Re-analyze:** Score de Vito subió de 5/10 → 7/10, auto-movió a Customer
- **Funnel Kanban:** 3 columnas (Lead/Opportunity/Customer), stats bar con conversiones
- **Drag & drop:** Mover Genner de Opportunity → Customer, toast confirmación, stats actualizadas
- **Agent column:** Muestra "Agente de Prueba" con badge "web" (post Hotfix #13)
- **Captured Variables:** Nulls filtrados (post Hotfix #13)
- **PDF RAG:** PDF de 550KB procesado → 39 chunks → "Ready"
- **Scoring worker:** Auto-trigger después de ≥6 mensajes, manual re-analyze funciona
- **Delete button:** Visible en detalle con Modal de confirmación (post Hotfix #13)

### ❌ Pendiente (Hotfix #13b):
- Delete contact falla por FK constraint (fix descrito arriba)

### ⚠️ Observaciones menores (no bloquean):
- Contactos "Unknown" son sesiones de widget sin variable capture — normal, no es bug
- `util._extend` deprecation warning en Next.js — es de Next.js internamente, no del proyecto
- WebSocket disconnect/reconnect frecuente en logs de consola — cosmético, no afecta funcionalidad

---

## 4. Datos de Testing en BD

### Organización principal:
- **Org ID:** `198e98cd-aaa0-4aef-ad79-a3273c609baf`
- **Nombre:** Genner Puello
- **Plan:** free
- **User:** cuenta principal (login en dashboard)

### Agentes:
- **Agente de Prueba** (org principal): `066d2687-d6b1-4d1e-a5dc-0f44255cfa37`
  - Canal: web, status: published
  - Knowledge: `codigos.md` (1 chunk), PDF de 550KB (39 chunks)
  - Variables: referrer, servicio, user_name, user_email, fingerprint
- **Agente de Pruebas** (Starter User): `bae3fa0c-2d0c-433e-9b8e-c48845424839`
  - PDF subido y procesado correctamente

### Contactos relevantes:
| Nombre | Email | Score | Stage | Service | Agente |
|--------|-------|-------|-------|---------|--------|
| Vito teran | vito@yopmail.com | 7/10 | Customer | SEO | Agente de Prueba |
| Genner | genner@yopmail.com | 4/10 | Customer | unknown | Agente de Prueba |
| Genner (2do) | genner@yopmail.com | — | Lead | — | Agente de Prueba |
| Unknown (×4) | — | — | Lead | — | Agente de Prueba |

---

## 5. Workers Activos

```typescript
// apps/api/src/index.ts
startMessageWorker();    // message-processing queue
startRagWorker();        // rag-processing queue
startScrapingWorker();   // scraping-processing queue
startScoringWorker();    // ai-scoring queue (NUEVO en Fase 6)
```

### Scoring Worker triggers:
1. **Auto (message_threshold):** Después de ≥6 mensajes en conversación, si ai_score es null, enqueue con 5s delay
2. **Manual (POST /contacts/:id/analyze):** Re-analyze button en contact detail
3. **Conversation close (PUT /conversations/:id/close):** Al cerrar conversación

### Scoring behavior:
- Usa GPT-4o-mini para eficiencia
- Score 0-3 → stay Lead
- Score 4-6 → auto-move to Opportunity
- Score 7-10 → auto-move to Customer
- Emite `contact:scored` WebSocket event

---

## 6. Archivos Clave Modificados en Fase 6

### Backend (apps/api/src/):
- `services/contact.service.ts` — CRUD completo de contactos
- `services/ai-scoring.service.ts` — **NUEVO** — scoring con LLM
- `workers/scoring.worker.ts` — **NUEVO** — BullMQ worker
- `routes/contacts.ts` — Reemplazado (era placeholder)
- `routes/funnel.ts` — Reemplazado (era placeholder)
- `index.ts` — Agregado `startScoringWorker()`
- `services/variable-capture.service.ts` — emit incluye contactId (Hotfix #13)

### Frontend (apps/web/):
- `app/dashboard/contacts/page.tsx` — Reemplazado (era placeholder)
- `app/dashboard/contacts/[id]/page.tsx` — Reemplazado (era placeholder)
- `app/dashboard/funnel/page.tsx` — Reemplazado (era placeholder)
- `components/crm/` — **12 nuevos componentes:**
  - ContactList, ContactFilters, ContactHeader, ContactSummary
  - ContactNotes, ContactConversations, ContactVariables, ContactTimeline
  - ScoreBadge, StageBadge
- `components/funnel/` — **4 nuevos componentes:**
  - KanbanBoard, KanbanColumn, KanbanCard, FunnelStats

### Migrations:
- `025_fix-contact-agent-id.sql` — Fix retrospectivo agent_id NULL (Hotfix #13)

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

---

## 8. Próximos Pasos

### Inmediato:
1. ✅ Aplicar Hotfix #13b (FK constraint)
2. ✅ Re-test delete contact
3. ✅ Limpiar contactos de testing "Unknown" no necesarios

### Fase 7 — Calendario (según dev-plan.md):
```
Backend: CRUD calendars, appointments, available-slots calculation, reminder jobs
Tool integration: agent calls check_availability/book_appointment
Frontend: /calendar → monthly view, appointment blocks colored by agent, click for detail modal, filters
Calendar config in /agents/[id]/tools
```

### Fases restantes:
| Fase | Descripción | Días estimados |
|------|-------------|----------------|
| 7 | Calendario | 3 |
| 8 | Billing (Stripe) | 3 |
| 9 | Notifications + Dashboard Analytics | 2 |
| 10 | i18n + GDPR | 2 |
| 11 | App Móvil (diferible) | 5 |
| 12 | MCP + Polish + Deploy | 5 |

### Features diferibles (post-MVP):
- App Móvil (Fase 11) — dashboard responsive es suficiente
- MCP integration (Fase 12.1) — feature avanzado
- Blog — lanzar sin blog
- Sub-cuentas — cuentas independientes por ahora
- WhatsApp Embedded Signup — usar solo guía manual

---

## 9. Stack Técnico Actual

```
Frontend:  Next.js 16 (App Router) — Port 3000
Backend:   Express.js 5 — Port 4000
Database:  PostgreSQL 16 + pgvector
Cache:     Redis (BullMQ + contadores)
Workers:   message, rag, scraping, scoring
WebSocket: socket.io
LLM:       OpenAI (GPT-4o-mini, text-embedding-ada-002) + Anthropic (configurado)
Monorepo:  npm workspaces + Turborepo
```