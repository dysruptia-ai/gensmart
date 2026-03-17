# GenSmart — Comandos Redis para Verificación E2E

> **Conectar a Redis:** `redis-cli` (si Redis corre local en puerto default 6379)
> **Si usa Docker:** `docker exec -it <container_name> redis-cli`

---

## 1. Usage Counters (Mensajes por mes)

```bash
# Ver el contador de mensajes de una org para el mes actual
# Formato key: usage:{orgId}:{YYYY-MM}:messages
# Primero busca las keys que existen:
redis-cli KEYS "usage:*:messages"

# Ver valor de un counter específico (reemplaza el orgId y fecha):
redis-cli GET "usage:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:2026-02:messages"

# Setear manualmente el counter (útil para simular límite alcanzado):
# Ejemplo: setear a 50 para probar límite Free plan
redis-cli SET "usage:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:2026-02:messages" 50

# Resetear counter a 0:
redis-cli SET "usage:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:2026-02:messages" 0

# Ver TTL del counter (debería ser ~35 días):
redis-cli TTL "usage:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:2026-02:messages"
```

## 2. Message Buffer

```bash
# Ver buffers activos (mensajes pendientes de procesar):
redis-cli KEYS "buffer:*"

# Ver mensajes en un buffer específico de una conversación:
redis-cli LRANGE "buffer:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" 0 -1

# Ver cuántos mensajes hay en un buffer:
redis-cli LLEN "buffer:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

## 3. Preview/Sandbox Sessions

```bash
# Ver sesiones de preview activas:
redis-cli KEYS "preview:*"

# Ver contenido de una sesión de preview:
redis-cli GET "preview:agentId:userId"

# Ver TTL de una sesión (debería ser ~30 min):
redis-cli TTL "preview:agentId:userId"
```

## 4. BullMQ Queues

```bash
# Ver todas las keys de BullMQ:
redis-cli KEYS "bull:*"

# Ver jobs pendientes en la queue de mensajes:
redis-cli LRANGE "bull:message-processing:wait" 0 -1

# Ver jobs activos:
redis-cli LRANGE "bull:message-processing:active" 0 -1

# Ver jobs completados (últimos):
redis-cli LRANGE "bull:message-processing:completed" 0 9

# Ver jobs fallidos:
redis-cli LRANGE "bull:message-processing:failed" 0 -1

# Lo mismo aplica para las otras queues:
# bull:rag-processing:wait / active / completed / failed
# bull:scraping-processing:wait / active / completed / failed
# bull:ai-scoring:wait / active / completed / failed
```

## 5. Comandos Generales Útiles

```bash
# Ver TODAS las keys en Redis (cuidado en producción):
redis-cli KEYS "*"

# Ver todas las keys de GenSmart (filtrar por patrón):
redis-cli KEYS "usage:*"
redis-cli KEYS "buffer:*"
redis-cli KEYS "preview:*"
redis-cli KEYS "bull:*"

# Contar keys por patrón:
redis-cli KEYS "usage:*" | wc -l

# Borrar una key específica:
redis-cli DEL "usage:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:2026-02:messages"

# Borrar todo (SOLO en desarrollo!):
redis-cli FLUSHALL

# Info general de Redis (memoria, clientes, etc.):
redis-cli INFO

# Monitorear en real-time todos los comandos que llegan a Redis:
# (muy útil para debugging — muestra cada operación en vivo)
redis-cli MONITOR
```

## 6. Tip: Monitorear en Real-Time

Para ver qué pasa en Redis mientras pruebas, abre una terminal aparte y ejecuta:

```bash
redis-cli MONITOR
```

Esto te muestra CADA operación en tiempo real. Vas a ver cosas como:
```
"RPUSH" "buffer:conv-id" "Hola soy Juan"
"INCR" "usage:org-id:2026-02:messages"
"GET" "preview:agent-id:user-id"
```

Esto es invaluable para confirmar que el message buffer, counters y preview funcionan correctamente.