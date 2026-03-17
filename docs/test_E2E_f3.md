## PARTE B: Fase 3.1 — CRUD de Agentes
### Lista de agentes (/agents)✅
### Crear agente desde cero✅
### Crear agente desde plantilla✅
### AgentCard en grid✅
### Plan limits✅
### Avatar upload❌
-En editor del agente → click en avatar → permite subir imagen❌
-Upload PNG < 2MB → avatar se actualiza en editor❌
-Upload archivo > 2MB → error de validación❌
-Upload archivo no-imagen (ej: .txt) → error de validación❌
-Avatar actualizado se refleja en AgentCard de /agents❌
-Eliminar avatar → vuelve a mostrar iniciales❌
-Iniciales: color consistente basado en nombre del agente❌
Nota: el avatar en el editor no es clickeable
---
## PARTE C: Fase 3.1 — Editor del Agente (/agents/[id])

### Layout general del editor
-Botón "Preview" visible❌(imagen 1)
---
### Tab Prompt✅
---
### Tab Settings
-Plan Free → solo muestra GPT-4o-mini (no GPT-4o ni Claude Sonnet)❌ -> Si selecciono OpenAI ->muestra ambos(GPT-4o-mini y GPT-4o) y si selecciono anthropic -> muestra ambos haiku y sonnet (imagen 2)

-Max tokens input: dentro del límite del plan (Free: max 512)❌ -> muestra 1024 (imagen 2)
-Context window messages input: dentro del límite del plan (Free: max 10)❌ -> muestra 15(imagen 2)

---
### Publish & Versioning✅
---
## PARTE D: Fase 3.2 — Variables Editor✅
---
## PARTE E: Fase 3.3 — AI Prompt Generator

-Botón "Apply Prompt" → copia prompt al editor, cierra modal✅ -> No cierra el modal❌
-Botón "Apply Variables" → agrega variables al VariablesEditor✅ -> pero repite las variables, porque como no cerró el modal cuando le di clic sobre "Apply Prompt",luego le di clic en  "Apply Variables" tampoco cerró el modal y por ultimo le di clic a "Apply All". No valida que las variables existan❌ y si cierra el modal✅
-Botón "Apply All" → aplica prompt + variables✅ -> pero se repiten las variables si ya existen en el prompt❌
-Si ya existe prompt → advertencia "This will replace your current prompt"❌ -> NO advierte solo lo pega el prompt generado en la tab Prompt
---
### Lista y catálogo✅
---
### Custom Function Builder
-Seleccionar "Custom Function" → formulario CustomFunctionBuilder abre✅
-Campos visibles: function name, description, endpoint URL, method dropdown✅
-Headers: key-value editor → agregar par → remover par❌
-Authentication: selector None / Bearer / API Key ❌
-Seleccionar "Bearer" → campo token aparece❌
-Parameters: agregar parámetro (name✅, type✅, description✅, required❌) → genera schema❌
-Body Template: editor JSON con placeholders {{param}}❌
-Response Mapping: campos Path y Format❌
-Timeout slider (1s - 30s)❌
ver imagen 3
-Guardar → tool aparece en lista con toggle enable/disable✅ -> al darle enable sale este error en dev tools -> ver imagen 4

-**Test panel**: ingresar valores de test → click "Test" → muestra response + latencia -> No encuentro este test panel❌
-Test con URL inválida → error manejado sin crash❌ -> no encuentro el test panel
-Editar tool existente → cambios persisten✅
-Eliminar tool → confirmación → desaparece✅
-Plan limit: Free no permite custom functions → mensaje upgrade❌ -> Me dejo agregar funciones y yo soy free

---
### Scheduling
-Seleccionar "Scheduling" → formulario de configuración✅
-Selector de calendario (puede estar vacío si no hay calendarios aún)❌-> ese campo no está
-Preview de funciones: check_availability, book_appointment❌ -> mira la imagen 5, no aparece ningun preview
-Guardar → tool aparece en lista✅

---
### Knowledge Base / RAG
-Seleccionar "Knowledge Base" → zona de upload drag-drop✅
-Upload archivo .pdf o .md → archivo aparece en lista con status "processing"✅ -> Solo aparece en la lista sin ningun status -> ver imagen 6
-Input URL para web scraping visible + botón "Add URL"❌ -> No existe
-Indicador de límite: "1/1 files" (Free plan)❌ -> No existe
-Exceder límite → mensaje de upgrade❌ -> No existe
-Botón reprocess por archivo visible❌ -> No existe
-Eliminar archivo → desaparece de la lista✅
-Nota: procesamiento real (chunking/embedding) se verifica en Fase 4✅

---
### MCP Server
-Seleccionar "MCP Server" → formulario de configuración✅
-Campos: Server URL✅, Transport (SSE/Streamable HTTP❌), Name✅
-Plan Free → no permite MCP → mensaje upgrade❌ -> me dejo crear el MCP y soy free -> ver imagen 7
-Guardar configuración (sin testear conexión real — Fase 12)✅

---
### Toggle y gestión general
-Toggle enable/disable en cualquier tool → estado cambia visualmente✅
-Múltiples tools → todas visibles en lista con tipo badge✅ -> ver imagen 8 muestra el listado de las tools


## PARTE G: Fase 3.5 — LLM Service (verificación indirecta)✅
---
## PARTE H: Calidad General✅
