# GenSmart — Checkpoint de Proyecto

> **Fecha:** 2026-02-24  
> **Estado:** Spec y Plan de Desarrollo COMPLETADOS. Listo para iniciar Fase 0.  
> **Desarrollador:** Genner (solo developer)  
> **Metodología:** Claude Desktop (Capitán) → Genner (Puente/QA) → Claude Code (Ejecutor)

---

## Archivos Clave del Proyecto

- **spec.md** — Especificación técnica completa v2.0 (adjunta al proyecto)
- **dev-plan.md** — Plan de desarrollo en 12 fases / 50 días (adjunta al proyecto)

Ambos archivos están finalizados y listos para ejecución. Claude Desktop debe leerlos al inicio de cada nueva conversación.

---

## Decisiones Tomadas (Resumen Rápido)

| Decisión | Resultado |
|----------|-----------|
| LLM Providers | OpenAI (GPT-4o, GPT-4o-mini) + Anthropic (Claude Sonnet, Haiku) |
| WhatsApp API | Meta Cloud API (oficial) + Embedded Signup + docs fallback |
| Infraestructura | AWS Lightsail, instancia única siempre, escalar vertical |
| Base de datos | PostgreSQL 16 + pgvector (NO SQLite) |
| Auth | Custom JWT desde cero (NO NextAuth). Access token en memoria, refresh en httpOnly cookie |
| Calendario | Propio dentro de GenSmart (no Google Calendar ni Calendly) |
| App móvil | React Native (Expo), SOLO para agentes Web (no WhatsApp) |
| Multi-tenancy | Sub-cuentas para agencias |
| Free Tier | Gratis de por vida (1 agente, 50 msgs/mes, 25 contactos, Web only, GPT-4o-mini) |
| Monetización | Precio fijo por plan + límites inteligentes (msgs/mes, modelo por plan, context window, max tokens) |
| BYO API Key | Solo Enterprise — usuario pone su key, sin límite de mensajes |
| Notificaciones MVP | In-app (bell icon) + email para eventos críticos |
| Dashboard métricas | Todas: leads, conversations, avg score, usage, top agents, funnel overview |
| Blog | Markdown files en el repo (SSG) |
| GDPR | Exportar datos (ZIP) + Eliminar cuenta (30 días gracia) |
| CSS | CSS Modules (sin librerías de terceros) |
| Iconos | lucide-react (nunca emojis) |
| Tipografía | Inter (Google Fonts) |
| Colores | Beige (#FAF8F5) + Verde WhatsApp (#25D366) + Blanco (#FFFFFF) |

---

## Funcionalidades Clave Definidas

### Sistema de Variables (Captura Inteligente)
- Usuario configura variables en el editor del agente (nombre, tipo, requerido, opciones para enum)
- GenSmart inyecta instrucciones automáticamente al final del system prompt
- Herramienta interna `capture_variable` registrada como tool para el LLM pero invisible al usuario final
- Backend intercepta tool_call → almacena en conversation.captured_variables → sincroniza con contacto CRM
- Campos base (name/phone/email) → columnas del contacto. Variables custom → JSONB

### Custom Functions (ej: consultar cédula)
- Usuario configura: nombre, descripción, endpoint URL, método, headers, auth, body_template con {{variables}}, response_mapping
- LLM hace tool_call → backend reemplaza variables → HTTP request → aplica mapping → retorna al LLM como tool_result
- Botón de test en el dashboard

### Herramientas Preestablecidas
- **Scheduling:** tool_calls check_availability() y book_appointment() que consultan calendario interno
- **RAG:** NO es tool_call — backend busca chunks similares antes de enviar al LLM e inyecta como contexto
- **Web Scraping:** Se indexa como RAG (contenido → chunks → embeddings)
- **MCP:** Conecta a servidores MCP externos via SSE

### Estrategia de Tokens (Control de Costos)
1. Mensajes/mes como límite principal (contador Redis, reset día 1)
2. Modelo LLM restringido por plan (Free: GPT-4o-mini only)
3. Context window limitado por plan (10/15/25/50 últimos mensajes)
4. Max tokens por respuesta limitado por plan (512/1024/2048/4096)
5. BYO Key para Enterprise (sin límite de mensajes)
6. Add-on de mensajes extra como one-time charge

### Preview vs Production
- **Preview/Sandbox:** Chat de pruebas en el editor, usa prompt draft, no afecta contadores, metadata visible
- **Conversations (Producción):** Vista real-time de conversaciones del agente desplegado, human takeover, variables sidebar

---

## Próximo Paso: FASE 0 — Fundación

### Lo que Genner debe hacer ANTES:
1. Crear carpeta del proyecto y abrirla en VS Code
2. Inicializar git: `git init`
3. Copiar spec.md y dev-plan.md a la raíz del proyecto
4. Tener Docker instalado (para PostgreSQL + Redis en dev)

### Lo que Claude Desktop debe hacer en la nueva conversación:
1. Leer spec.md y dev-plan.md del proyecto
2. Generar el prompt optimizado para que Claude Code ejecute la Fase 0 completa
3. La Fase 0 tiene 3 sub-fases:
   - 0.1 Scaffolding del Monorepo (npm workspaces, Turborepo, Next.js 16, Express.js 5, shared package)
   - 0.2 Base de Datos (PostgreSQL + pgvector, migraciones de TODAS las tablas, seeds)
   - 0.3 Design System (globals.css con variables, componentes UI base con CSS Modules)

### Prompt sugerido para iniciar nueva conversación con Claude Desktop:
```
Soy Genner, estoy desarrollando GenSmart. Lee spec.md y dev-plan.md adjuntos al proyecto.
Este es el checkpoint del proyecto: [pegar este archivo o adjuntarlo].
Necesito el prompt para que Claude Code ejecute la Fase 0 completa.
```

---

## Notas Importantes para Claude Desktop

- El spec.md y dev-plan.md son la fuente de verdad. Siempre referirse a ellos.
- Genner es el ÚNICO desarrollador. Todo se ejecuta vía Claude Code.
- Siempre generar prompts detallados y específicos para Claude Code.
- Cada sub-fase debe terminar con git commit.
- Verificar que cada tarea funciona antes de avanzar a la siguiente.
- Si Claude Code tiene problemas, Genner vuelve a Claude Desktop para resolver.