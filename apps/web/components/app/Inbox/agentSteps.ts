/**
 * "Lo que hizo el agente" (web-46): traduce `metadata.toolsCalled` de una respuesta del agente
 * (cadenas `nombre(argsJSON)`, a veces con el sufijo `[recovered]`) a pasos legibles.
 *
 * Nunca muestra los argumentos crudos ni nada de `toolTrace`: pueden tener datos del cliente o
 * respuestas largas de APIs. De los argumentos solo se usan los nombres de las variables capturadas
 * y la fecha consultada en la agenda.
 */

type T = (key: string, values?: Record<string, string | number>) => string;

export interface ParsedToolCall {
  name: string;
  args: Record<string, unknown> | null;
  recovered: boolean;
}

const RECOVERED = '[recovered]';

export function parseToolCall(entry: string): ParsedToolCall {
  let raw = entry.trim();
  const recovered = raw.endsWith(RECOVERED);
  if (recovered) raw = raw.slice(0, -RECOVERED.length).trimEnd();
  const open = raw.indexOf('(');
  if (open <= 0) return { name: raw, args: null, recovered };
  const name = raw.slice(0, open).trim();
  const body = raw.endsWith(')') ? raw.slice(open + 1, -1) : '';
  let args: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) args = parsed as Record<string, unknown>;
  } catch {
    args = null;
  }
  return { name, args, recovered };
}

/** Herramientas con un texto fijo (clave en `inbox.steps.*`). */
const FIXED_STEPS: Record<string, string> = {
  book_appointment: 'booked',
  request_human_handoff: 'handoff',
  send_media: 'sentMedia',
  add_to_cart_widget: 'cartAdd',
  remove_from_cart_widget: 'cartRemove',
  get_cart_widget: 'cartView',
  dropi_buscar_productos: 'dropiSearch',
  dropi_listar_categorias: 'dropiCategories',
  dropi_ver_opciones: 'dropiOptions',
  dropi_cotizar_envio: 'dropiQuote',
  dropi_preparar_pedido: 'dropiPrepare',
  dropi_confirmar_pedido: 'dropiConfirm',
  dropi_estado_pedido: 'dropiStatus',
};

const VARIABLE_NAME_RE = /^[\p{L}\p{N}_ -]{1,40}$/u;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Nombre de una herramienta desconocida (función personalizada o MCP) para "Usó {nombre}". */
function displayName(name: string): string {
  const base = name.startsWith('mcp_') ? name.slice(4) : name;
  return base.replace(/_/g, ' ').trim().slice(0, 60) || name;
}

export interface StepOptions {
  /** Formatea la fecha `YYYY-MM-DD` de check_availability (por defecto, tal cual). */
  formatDate?: (isoDate: string) => string;
}

/** Los pasos de un turno del agente, en orden. Todas las capturas van juntas en un solo paso. */
export function agentSteps(toolsCalled: unknown, t: T, opts: StepOptions = {}): string[] {
  if (!Array.isArray(toolsCalled)) return [];
  const calls = toolsCalled.filter((e): e is string => typeof e === 'string' && e.trim() !== '').map(parseToolCall);
  const steps: Array<string | { capture: true }> = [];
  const captured: string[] = [];
  let captureIndex = -1;

  for (const call of calls) {
    if (call.name === 'capture_variable') {
      const v = call.args?.['variable_name'];
      if (typeof v === 'string' && VARIABLE_NAME_RE.test(v.trim()) && !captured.includes(v.trim())) captured.push(v.trim());
      if (captureIndex === -1) {
        captureIndex = steps.length;
        steps.push({ capture: true });
      }
      continue;
    }
    if (call.name === 'check_availability') {
      const date = call.args?.['date'];
      steps.push(
        typeof date === 'string' && ISO_DATE_RE.test(date)
          ? t('inbox.steps.checkedDate', { date: opts.formatDate ? opts.formatDate(date) : date })
          : t('inbox.steps.checked')
      );
      continue;
    }
    const fixed = FIXED_STEPS[call.name];
    steps.push(fixed ? t(`inbox.steps.${fixed}`) : t('inbox.steps.used', { name: displayName(call.name) }));
  }

  return steps.map((s) =>
    typeof s === 'string'
      ? s
      : captured.length > 0
        ? t('inbox.steps.captured', { names: captured.join(', ') })
        : t('inbox.steps.capturedNone')
  );
}
