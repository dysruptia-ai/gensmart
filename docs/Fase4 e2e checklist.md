# GenSmart — Fase 4: Checklist de Pruebas E2E

> **Pre-requisito:** Servidor dev corriendo (Next.js + Express + Redis + PostgreSQL)
> **Tip:** Abre las DevTools (Console + Network) durante todas las pruebas

---

## 1. Message Buffer + Worker

### 1.1 Setup previo
- [✅] Crear un agente con system prompt, al menos 2 variables (ej: nombre string required, servicio enum required), y publicarlo
- [✅] Verificar que los workers están corriendo (logs en terminal: message worker, rag worker, scraping worker)
- [✅] Verificar que Redis está corriendo y accesible

--- logs ---
@gensmart/api:dev: WebSocket server ready
@gensmart/api:dev: Workers started: message, rag, scraping
@gensmart/api:dev: Redis connected

### 1.2 Buffer y procesamiento
- [✅] Crear una conversación manualmente vía API (o usar el preview para verificar el flujo):
  ```
  POST /api/conversations (si existe) o usar preview como proxy de prueba
  ```
- [❌] Enviar un mensaje → verificar en logs que el buffer acumula y el worker procesa después del delay (default 5s) -> no espera los 5 segundos para contestar. Preview -> No me deja enviar varios mensajes rápido,porque desde el primer mensaje pierde el foco. Debe comportarse como WhasApp que envia el mensaje y pone el foco nuevamente para enviar otro mensaje enseguida.
La UI luce fea no descrimina el tipo de mensaje por ROL imagen1 - No parece un chat

- [❌] Enviar 2-3 mensajes rápidos (antes de que expire el timer) → verificar que se concatenan en un solo LLM call -> No esta esperando los 5segundos, contesta rapido el primer mensaje enviado

- [❌] Verificar en BD: tabla `messages` tiene el mensaje del user (role='user') y la respuesta (role='assistant') -> Estoy haciendo las pruebas con el **preview** -> tanto la tabla `messages` y `conversations` esta vacia.
  
- [❌] Verificar en BD: `conversations.last_message_at` y `message_count` se actualizan -> La tabla esta vacia, creo que porque estoy haciendo las pruebas con el **Preview**

### 1.3 Usage counters -> Preview al parecer no dispara nada en Redis
- [❌] Verificar en Redis: key `usage:{orgId}:{YYYY-MM}:messages` se incrementa después de cada respuesta
- [❌] Simular límite alcanzado: setear el counter en Redis al máximo del plan → enviar mensaje → verificar que NO se procesa y se genera notificación de límite
- NOTA : Preview no dispara ningun mensaje en Redis, porque mira esta consulta en redis:
```
127.0.0.1:6379> KEYS "usage:*:messages"
(empty array)
```
Y he estado enviando mensaje a través del preview del agente y contesta bien y captura las variables correctamente imagen1

### 1.4 Tool call loop
- [ ] Si el agente tiene custom function configurada (de Fase 3), verificar que el LLM la llama y el worker ejecuta el HTTP request
- [ ] Verificar que tool_result se re-envía al LLM y genera respuesta final con la info obtenida

### 1.5 Errores
- [ ] Detener Redis temporalmente → enviar mensaje → verificar que hay error handling (no crash)
- [ ] Configurar una custom function con URL inválida → verificar que el error se retorna al LLM como tool_result y el LLM responde gracefully

---

## 2. Variable Capture

### 2.1 Captura automática
- [✅] Enviar mensaje que contenga un nombre (ej: "Hola, soy Juan Pérez") → verificar que el LLM llama `capture_variable(nombre, "Juan Pérez")`
- [❌] Verificar en BD: `conversations.captured_variables` contiene `{"nombre": "Juan Pérez"}`
- [❌] Verificar en BD: `contacts.name` se actualizó a "Juan Pérez"
**Nota**: al parecer el preview no inserta nada en la base de datos, porque si esta capturando bien las variables (ver imagen1), pero en las tablas no almacena nada

### 2.2 Captura de enum
- [✅] Enviar mensaje con opción de enum (ej: "Me interesa SEO") → verificar captura con valor válido del enum
- [✅] Verificar que valores fuera del enum no se capturan (o se manejan correctamente) -> todos se manejan correctamente

### 2.3 Auto-creación de contacto
- [❌] En una conversación sin contacto asociado → capturar primera variable → verificar que se crea un contacto nuevo en BD
- [❌] Verificar: `contacts.agent_id`, `contacts.source_channel`, `contacts.organization_id` correctos
- [❌] Verificar: `conversation.contact_id` se asocia al nuevo contacto

### 2.4 Sincronización de campos
- [❌] Capturar variable "email" → verificar que `contacts.email` se actualiza (no solo custom_variables)
- [❌] Capturar variable "telefono" → verificar que `contacts.phone` se actualiza
- [❌] Capturar variable custom (ej: "presupuesto") → verificar que va a `contacts.custom_variables` JSONB

### 2.5 WebSocket
- [❌] Tener el dashboard abierto en `/conversations/[id]` → capturar variable → verificar que la VariablesSidebar se actualiza en real-time sin refresh
NOTA: no puedo verificar porque Preview no toca las tablas.
---

## 3. RAG Pipeline

### 3.1 Procesamiento de archivos
- [✅] Ir a `/agents/[id]` → tab Tools → Knowledge Base
- [❌] Subir un archivo .txt → verificar que status cambia: processing → ready
- [❌] Subir un archivo .md → verificar: processing → ready
- [❌] Subir un archivo .pdf → verificar: processing → ready
- [❌] Subir un archivo .docx → verificar: processing → ready
AL seleccionar un archivo no aparece que esta procesando...❌
- [❌] Verificar en BD: `knowledge_files` tiene status='ready' y chunk_count > 0
- [❌] Verificar en BD: `knowledge_chunks` tiene registros con embeddings (vector no null)

### 3.2 Procesamiento de URLs
- [✅] Agregar una URL válida (ej: página simple con contenido) → verificar: processing → ready
- [✅] Agregar una URL inválida → verificar: processing → error con mensaje descriptivo

### 3.3 Reprocess
- [❌] Click en botón Reprocess de un archivo → verificar que se re-procesa (status vuelve a processing → ready)

### 3.4 RAG en conversación
- [❌] Tener un agente con knowledge base (archivos procesados) y publicado
- [❌] Enviar un mensaje cuya respuesta requiera info del knowledge base
- [❌] Verificar en logs del worker que se inyecta "KNOWLEDGE BASE CONTEXT:" con chunks relevantes
- [❌] Verificar que la respuesta del AI incluye información del knowledge base
Nota: Se proceso bien una url y guardo en la tabla de chunks bien los vectores, pero no responde nada utilizando esa informacion. -> no esta utilizando la tool (imagen 3)
### 3.5 Límites del plan
- [✅] Verificar que el indicador "Documents: X/Y" refleja correctamente los archivos procesados
- [✅] Intentar subir más archivos que el límite del plan → verificar que se bloquea -> En plan FREE se proceso una url y con eso ya el limite se copo

---

## 4. Conversations & Chat View -> No pude revisar esta parte

### 4.1 Lista de conversaciones
- [✅] Navegar a `/conversations` → verificar que carga la lista (o muestra empty state si no hay) -> Muestra empty state
- [❌] Verificar que cada conversación muestra: nombre contacto (o phone), último mensaje truncado, timestamp, channel badge, status badge
- [❌] Filtrar por agente → verificar que filtra correctamente
- [❌] Filtrar por canal (Web/WhatsApp) → verificar
- [❌] Filtrar por status (active/closed/human_takeover) → verificar
- [❌] Buscar por nombre o teléfono → verificar
- [❌] Verificar paginación si hay suficientes conversaciones

### 4.2 Chat View
- [ ❌] Click en una conversación → navegar a `/conversations/[id]`
- [ ❌] Verificar layout: lista sidebar (o navegación) | chat centro | detalles derecha
- [❌ ] Verificar que los mensajes se muestran con estilos correctos:
  - [ ❌] role='user' → burbuja izquierda, color claro
  - [ ❌] role='assistant' → burbuja derecha, color primary light
  - [ ❌] role='human' → burbuja derecha con badge "Human", color diferente
  - [❌ ] role='system' (intervention_summary) → divider/pill central
- [ ❌] Verificar timestamps en cada mensaje
- [❌ ] Verificar auto-scroll al último mensaje
- [❌ ] Verificar "load more" para mensajes antiguos (paginación)

### 4.3 Details panel (derecha)
- [❌] Verificar info del contacto: nombre, phone, email, avatar, score badge
- [❌] Verificar VariablesSidebar: muestra variables capturadas con sus valores
- [❌] Variables required sin capturar deben tener indicador visual (pending badge)

### 4.4 WebSocket real-time
- [❌] Tener `/conversations` abierto en el navegador
- [❌] Desde otra pestaña o vía API, generar un nuevo mensaje en una conversación
- [❌] Verificar que la lista se actualiza en real-time (nuevo mensaje, reorder)
- [❌] Tener `/conversations/[id]` abierto → generar mensaje → verificar que aparece sin refresh

### 4.5 Responsive
- [❌] Reducir viewport a mobile → verificar que la UI se adapta (no se rompe)
- [❌] En mobile: verificar que se puede navegar entre lista y chat

---

## 5. Human Takeover

### 5.1 Plan enforcement
- [ ❌] Con usuario Free plan → ir a una conversación → verificar que el botón "Take Over" no aparece o muestra "Upgrade to enable human takeover"
- [ ❌] Con usuario Starter/Pro/Enterprise → verificar que el botón "Take Over" está disponible

### 5.2 Takeover flow
- [❌] Click "Take Over" → verificar:
  - [ ❌] Banner cambia a "You are in control" + botón "Release to AI"
  - [ ❌] Input de texto aparece (antes estaba hidden)
  - [ ❌] BD: `conversation.status = 'human_takeover'`, `taken_over_by` = tu user ID
- [❌] Escribir y enviar un mensaje como humano → verificar:
  - [ ❌] Mensaje aparece con estilo diferente (badge "Human")
  - [ ❌] Se guarda en BD con role='human'
- [❌ ] Mientras estás en takeover → simular un mensaje entrante del usuario → verificar que el message worker NO procesa (no hay respuesta AI)

### 5.3 Release flow
- [❌ ] Click "Release to AI" → verificar:
  - [❌] Banner vuelve a "AI Agent is handling this conversation"
  - [ ❌] Input de texto desaparece
  - [ ❌] BD: `conversation.status = 'active'`, `taken_over_by = NULL`
  - [ ❌] Se genera un mensaje role='system' con intervention summary
  - [ ❌] El divider/pill del summary es visible en el chat
- [ ❌] Enviar un nuevo mensaje del usuario → verificar que el AI retoma y responde normalmente

### 5.4 Multi-usuario
- [ ❌] Si otro usuario del mismo org está viendo la misma conversación → verificar que ve "Taken over by [nombre]" y no puede tomar control simultáneamente

### 5.5 WebSocket
- [❌] Takeover/release emite eventos en real-time → la lista de conversaciones actualiza el status badge
Nota: No pude ver como probar los mensajes, sino es con el preview
---

## 6. Preview/Sandbox

### 6.1 Preview básico
- [✅] Ir a `/agents/[id]` → click botón Preview
- [✅] Verificar banner "PREVIEW MODE — No messages are counted"
- [✅] Enviar mensaje → verificar que responde usando el draft prompt (no el publicado) -> responde con el prompt que esta en la pestaña "prompt"
- [✅] Verificar metadata pill: latencia, tokens, modelo -> Si se ve

### 6.2 Preview con tools
- [✅] Agente con variables configuradas → en preview, dar info que active capture_variable → verificar que se capturan y se muestran en la sección de variables del preview
- [❌] Agente con custom function → verificar que se ejecuta en preview -> no se ejecutan

### 6.3 Preview con RAG
- [❌] Agente con knowledge base → preguntar algo del knowledge → verificar que responde con info del RAG

### 6.4 Reset
- [✅] Click botón Reset → verificar que el historial se limpia y empieza de nuevo

### 6.5 No afecta contadores
- [❌] Verificar en Redis que el counter `usage:{orgId}:{YYYY-MM}:messages` NO se incrementa después de usar preview -> no existe ese contador ->
```127.0.0.1:6379> KEYS "usage:*:messages"
(empty array)```
- [✅] Verificar en BD que NO se crean conversations/messages/contacts reales

### 6.6 Publish desde preview
- [✅] Click botón Publish → verificar que el agente se publica (nueva versión)

---

## 7. Errores y Edge Cases

- [ ] Conversación sin contacto → verificar que no crashea la UI
- [ ] Agente sin variables → verificar que variable capture instructions no se inyectan
- [ ] Agente sin knowledge base → verificar que RAG step se salta sin error
- [ ] Agente sin tools → verificar que el worker procesa normalmente (solo texto)
- [ ] Mensaje vacío → verificar validación
- [ ] Conversación ya cerrada → verificar que no se pueden enviar mensajes
- [ ] Network tab: verificar que no hay requests fallidos (4xx/5xx) inesperados en flujos normales
- [ ] Console: verificar que no hay errores JS en flujos normales

---

## Resumen Rápido

| Área | Tests |
|------|-------|
| Message Buffer + Worker | 12 |
| Variable Capture | 10 |
| RAG Pipeline | 11 |
| Conversations & Chat View | 16 |
| Human Takeover | 10 |
| Preview/Sandbox | 9 |
| Errores y Edge Cases | 8 |
| **Total** | **~76 tests** |

---

## Cómo reportar bugs

Para cada bug encontrado, reportar:
1. **Qué sección** (ej: "4.2 Chat View")
2. **Pasos para reproducir**
3. **Resultado esperado vs resultado actual**
4. **Screenshot si es visual**
5. **Error de consola si aplica**

Consolidar todos los bugs y enviarlos juntos para un hotfix batch.