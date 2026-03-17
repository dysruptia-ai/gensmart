# GenSmart — Pruebas E2E: Fase 3 (Agentes AI Core)

> **Fecha:** 2026-02-25
> **Pre-requisito:** Estar logueado en /dashboard con cuenta Free (para testear límites)
> **Herramientas:** Browser DevTools (Console + Network), Google Authenticator (si se retestea 2FA)

---



## PARTE B: Fase 3.1 — CRUD de Agentes

### Lista de agentes (/agents)
| # | Test | Estado |
|---|------|--------|
| 27 | /agents → página carga sin errores | |
| 28 | Sin agentes → muestra EmptyState ("Create your first AI agent" + CTA) | |
| 29 | Botón "New Agent" visible y prominente | |
| 30 | Indicador de plan limit visible (ej: "0/1 agents" para Free) | |

### Crear agente desde cero
| # | Test | Estado |
|---|------|--------|
| 31 | Click "New Agent" → wizard abre con opción "From Template" y "From Scratch" | |
| 32 | Click "From Scratch" → formulario con name + description | |
| 33 | Llenar name "Test Agent" + description → crear → redirige a editor /agents/[id] | |
| 34 | Volver a /agents → AgentCard visible con nombre, status "draft", iniciales como avatar | |

### Crear agente desde plantilla
| # | Test | Estado |
|---|------|--------|
| 35 | Click "New Agent" → click "From Template" → muestra grid de plantillas (3-5) | |
| 36 | Cada plantilla muestra: nombre, descripción, categoría | |
| 37 | Click en plantilla → crea agente → redirige a editor con prompt pre-configurado | |
| 38 | Editor tiene variables pre-configuradas de la plantilla | |
| 39 | Editor tiene herramientas sugeridas de la plantilla (si aplica) | |

### AgentCard en grid
| # | Test | Estado |
|---|------|--------|
| 40 | Card muestra: avatar (iniciales), nombre, descripción truncada, status badge "draft" | |
| 41 | Menú dropdown en card: opciones Edit, Duplicate, Delete visibles | |
| 42 | Click "Edit" → navega a /agents/[id] | |
| 43 | Click "Delete" → confirmación → elimina → desaparece de la lista | |
| 44 | Search bar: escribir nombre → filtra agentes en real-time | |

### Plan limits
| # | Test | Estado |
|---|------|--------|
| 45 | Con plan Free (1 agente): crear 1 agente → OK | |
| 46 | Intentar crear segundo agente → mensaje de error/upgrade (no permite) | |
| 47 | ProgressBar muestra "1/1 agents" | |

### Avatar upload
| # | Test | Estado |
|---|------|--------|
| 48 | En editor del agente → click en avatar → permite subir imagen | |
| 49 | Upload PNG < 2MB → avatar se actualiza en editor | |
| 50 | Upload archivo > 2MB → error de validación | |
| 51 | Upload archivo no-imagen (ej: .txt) → error de validación | |
| 52 | Avatar actualizado se refleja en AgentCard de /agents | |
| 53 | Eliminar avatar → vuelve a mostrar iniciales | |
| 54 | Iniciales: color consistente basado en nombre del agente | |

---

## PARTE C: Fase 3.1 — Editor del Agente (/agents/[id])

### Layout general del editor
| # | Test | Estado |
|---|------|--------|
| 55 | Header: nombre del agente visible (editable inline si aplica) | |
| 56 | Avatar visible en header | |
| 57 | Status badge visible (draft/active) | |
| 58 | Botón "Preview" visible | |
| 59 | Botón "Publish" visible | |
| 60 | Tabs visibles: Prompt, Variables, Tools, Settings, Versions | |
| 61 | Click en cada tab → cambia contenido sin errores | |

### Tab Prompt
| # | Test | Estado |
|---|------|--------|
| 62 | Textarea grande para system_prompt visible | |
| 63 | Si viene de plantilla → prompt pre-llenado | |
| 64 | Editar texto → se guarda (verificar con recarga o guardar) | |
| 65 | Botón "Generate with AI" visible (abre modal PromptGenerator — ver 3.3) | |
| 66 | Character/word count visible y se actualiza al escribir | |

### Tab Settings
| # | Test | Estado |
|---|------|--------|
| 67 | LLM Provider selector: muestra OpenAI / Anthropic | |
| 68 | Model selector: modelos filtrados por provider seleccionado | |
| 69 | Plan Free → solo muestra GPT-4o-mini (no GPT-4o ni Claude Sonnet) | |
| 70 | Temperature slider: 0.0 - 2.0, muestra valor actual | |
| 71 | Max tokens input: dentro del límite del plan (Free: max 512) | |
| 72 | Context window messages input: dentro del límite del plan (Free: max 10) | |
| 73 | Message buffer seconds: slider o input (1-30, default 5) | |
| 74 | Channels toggles: Web toggle visible, WhatsApp toggle (disabled si no conectado) | |
| 75 | Cambiar settings → guardar → recargar → valores persisten | |

### Publish & Versioning
| # | Test | Estado |
|---|------|--------|
| 76 | Click "Publish" → modal de confirmación | |
| 77 | Confirmar → toast success, status cambia a "active" | |
| 78 | Tab "Versions" → muestra versión 1 con fecha y usuario | |
| 79 | Editar prompt → Publish de nuevo → versión 2 aparece en lista | |
| 80 | Click "Rollback" en versión 1 → confirmación → prompt se restaura a v1 | |
| 81 | Indicador de cambios no publicados (si draft ≠ publicado) | |

---

## PARTE D: Fase 3.2 — Variables Editor

| # | Test | Estado |
|---|------|--------|
| 82 | Tab "Variables" → editor vacío con botón "Add Variable" | |
| 83 | Click "Add Variable" → nueva variable aparece con campos editables | |
| 84 | Editar Name: solo acepta slug format (lowercase, underscores, sin espacios) | |
| 85 | Type dropdown: opciones "string" y "enum" | |
| 86 | Seleccionar type "enum" → aparece campo de opciones | |
| 87 | Agregar opciones al enum (ej: seo, ads, social) como chips/tags | |
| 88 | Required toggle: funciona y se refleja en preview | |
| 89 | Description: input text, se usa en la instrucción al LLM | |
| 90 | Agregar 3 variables distintas → todas visibles en lista | |
| 91 | Reordenar variables (drag-and-drop o botones up/down) → orden cambia | |
| 92 | Eliminar variable → desaparece de la lista con confirmación | |
| 93 | **Preview de inyección** visible: muestra texto que se inyectará al LLM | |
| 94 | Preview se actualiza en real-time al editar cualquier variable | |
| 95 | Preview incluye: nombre, tipo, REQUIRED/OPTIONAL, descripción, opciones enum | |
| 96 | Guardar → recargar editor → variables persisten correctamente | |
| 97 | Si vino de template → variables pre-configuradas visibles | |

---

## PARTE E: Fase 3.3 — AI Prompt Generator

| # | Test | Estado |
|---|------|--------|
| 98 | En tab Prompt → click "Generate with AI" → modal PromptGenerator abre | |
| 99 | Textarea con placeholder descriptivo visible | |
| 100 | Language selector (EN/ES) visible | |
| 101 | Escribir descripción (ej: "An agent for a dental clinic that books appointments") | |
| 102 | Click "Generate" → loading state (spinner + "Generating...") | |
| 103 | Resultado: prompt generado visible en preview (readonly) | |
| 104 | Variables sugeridas mostradas como chips | |
| 105 | Herramientas sugeridas mostradas como badges | |
| 106 | Botón "Apply Prompt" → copia prompt al editor, cierra modal | |
| 107 | Botón "Apply Variables" → agrega variables al VariablesEditor | |
| 108 | Botón "Apply All" → aplica prompt + variables | |
| 109 | Botón "Cancel" → cierra modal sin cambios | |
| 110 | Si ya existe prompt → advertencia "This will replace your current prompt" | |
| 111 | Network tab: POST a /api/agents/generate-prompt retorna 200 | |
| 112 | Si no hay API key de OpenAI configurada → error manejado gracefully (no crash) | |

---

## PARTE F: Fase 3.4 — Herramientas del Agente

### Lista y catálogo
| # | Test | Estado |
|---|------|--------|
| 113 | Tab "Tools" → lista vacía con botón "Add Tool" | |
| 114 | Click "Add Tool" → catálogo con 5 tipos: Scheduling, Knowledge Base, Web Scraping, Custom Function, MCP | |
| 115 | Cada tipo muestra: icono lucide, nombre, descripción corta | |

### Custom Function Builder
| # | Test | Estado |
|---|------|--------|
| 116 | Seleccionar "Custom Function" → formulario CustomFunctionBuilder abre | |
| 117 | Campos visibles: function name, description, endpoint URL, method dropdown | |
| 118 | Headers: key-value editor → agregar par → remover par | |
| 119 | Authentication: selector None / Bearer / API Key | |
| 120 | Seleccionar "Bearer" → campo token aparece | |
| 121 | Parameters: agregar parámetro (name, type, description, required) → genera schema | |
| 122 | Body Template: editor JSON con placeholders {{param}} | |
| 123 | Response Mapping: campos Path y Format | |
| 124 | Timeout slider (1s - 30s) | |
| 125 | Guardar → tool aparece en lista con toggle enable/disable | |
| 126 | **Test panel**: ingresar valores de test → click "Test" → muestra response + latencia | |
| 127 | Test con URL inválida → error manejado sin crash | |
| 128 | Editar tool existente → cambios persisten | |
| 129 | Eliminar tool → confirmación → desaparece | |
| 130 | Plan limit: Free no permite custom functions → mensaje upgrade | |

### Scheduling
| # | Test | Estado |
|---|------|--------|
| 131 | Seleccionar "Scheduling" → formulario de configuración | |
| 132 | Selector de calendario (puede estar vacío si no hay calendarios aún) | |
| 133 | Preview de funciones: check_availability, book_appointment | |
| 134 | Guardar → tool aparece en lista | |

### Knowledge Base / RAG
| # | Test | Estado |
|---|------|--------|
| 135 | Seleccionar "Knowledge Base" → zona de upload drag-drop | |
| 136 | Upload archivo .pdf o .md → archivo aparece en lista con status "processing" | |
| 137 | Input URL para web scraping visible + botón "Add URL" | |
| 138 | Indicador de límite: "1/1 files" (Free plan) | |
| 139 | Exceder límite → mensaje de upgrade | |
| 140 | Botón reprocess por archivo visible | |
| 141 | Eliminar archivo → desaparece de la lista | |
| 142 | Nota: procesamiento real (chunking/embedding) se verifica en Fase 4 | |

### MCP Server
| # | Test | Estado |
|---|------|--------|
| 143 | Seleccionar "MCP Server" → formulario de configuración | |
| 144 | Campos: Server URL, Transport (SSE/Streamable HTTP), Name | |
| 145 | Plan Free → no permite MCP → mensaje upgrade | |
| 146 | Guardar configuración (sin testear conexión real — Fase 12) | |

### Toggle y gestión general
| # | Test | Estado |
|---|------|--------|
| 147 | Toggle enable/disable en cualquier tool → estado cambia visualmente | |
| 148 | Múltiples tools → todas visibles en lista con tipo badge | |

---

## PARTE G: Fase 3.5 — LLM Service (verificación indirecta)

| # | Test | Estado |
|---|------|--------|
| 149 | Apps API compila sin errores de TypeScript | |
| 150 | .env.example incluye OPENAI_API_KEY y ANTHROPIC_API_KEY | |
| 151 | AI Prompt Generator funciona (prueba indirecta de LLM service — test 102-111) | |
| 152 | Settings del agente: modelos filtrados por plan (test 69) | |
| 153 | Consola servidor: sin errores al startup relacionados con LLM imports | |

---

## PARTE H: Calidad General

| # | Test | Estado |
|---|------|--------|
| 154 | Consola browser: sin errores JS en /agents, /agents/new, /agents/[id] | |
| 155 | Consola servidor: sin errores al hacer CRUD de agentes | |
| 156 | Network: todas las llamadas API retornan 200/201 (excepto errores esperados) | |
| 157 | CSS: todos los componentes usan CSS Modules (no inline styles significativos) | |
| 158 | Iconos: solo lucide-react (sin emojis) | |
| 159 | Responsive: /agents y editor funcionan en mobile (< 768px) | |
| 160 | Responsive: wizard de creación funciona en mobile | |
| 161 | Loading states: spinners/skeletons mientras carga datos | |
| 162 | Toast notifications: aparecen en create, update, delete, publish | |

---

## Resumen

| Sección | Tests | Rango |
|---------|-------|-------|
| A — Bugfixes (Fase 1 & 2) | 26 | #1-26 |
| B — CRUD Agentes | 28 | #27-54 |
| C — Editor del Agente | 27 | #55-81 |
| D — Variables Editor | 16 | #82-97 |
| E — AI Prompt Generator | 15 | #98-112 |
| F — Herramientas del Agente | 36 | #113-148 |
| G — LLM Service | 5 | #149-153 |
| H — Calidad General | 9 | #154-162 |
| **TOTAL** | **162** | |

---

## Formato de Reporte

Al completar las pruebas, reportar con este formato:

```
### Sección X — Nombre
| # | Estado |
|---|--------|
| N | ✅ |
| N | ❌ (descripción del problema + screenshot si aplica) |
```

Prioridad de bugs encontrados:
- 🔴 CRÍTICO: bloquea flujo principal (no se puede crear/editar agentes)
- 🟡 IMPORTANTE: funcionalidad incompleta pero no bloquea
- 🟢 MENOR: visual/UX, no afecta funcionalidad