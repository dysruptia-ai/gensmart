/**
 * Horario de atención en el agente (web-45): el bloque del prompt fuera de horario. En inglés, como los
 * demás bloques internos; el agente responde en el idioma del cliente.
 */
import { isOpenAt, nextOpening } from '@gensmart/shared';
import type { InboxSettings } from './inbox-settings.service';

/** "Monday 08:00" en la zona de la organización. */
export function formatLocalOpening(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('weekday')} ${get('hour')}:${get('minute')}`;
}

/**
 * El bloque, o null si no aplica: aviso apagado, sin horario, o abierto ahora. Fuera de esos casos el
 * texto del agente no cambia.
 */
export function buildOutOfHoursPromptBlock(settings: InboxSettings, timeZone: string, now: Date = new Date()): string | null {
  if (!settings.outOfHoursNotice || settings.businessHours === null) return null;
  if (isOpenAt(settings.businessHours, timeZone, now)) return null;
  const next = nextOpening(settings.businessHours, timeZone, now);
  const when = next ? `${formatLocalOpening(next, timeZone)} (${timeZone} time)` : 'not scheduled';
  return [
    '## Team availability',
    `The human team is outside business hours right now. They are back on ${when}.`,
    'If the customer asks to talk to a person, or you need to hand the conversation to the team, tell the customer this ONCE in the conversation, in the customer\'s language: the team is not available right now and when they are back. Do not repeat it if you already said it in this conversation.',
    'Then keep helping with whatever you can.',
  ].join('\n');
}
