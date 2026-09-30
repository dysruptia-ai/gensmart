import type { HandoffConfig, HandoffContact } from '@gensmart/shared';
import { ToolDefinition } from './llm.service';
import { sendCtaUrlMessage } from './whatsapp.service';
import { createNotification } from './notification.service';
import { query } from '../config/database';
import { redis } from '../config/redis';

export const HANDOFF_CUSTOMER_MESSAGE_MAX = 300;
export const HANDOFF_PREFILL_MAX = 200;
const HANDOFF_FULL_TEXT_MAX = 350;

/** Tool definition — what the LLM sees. It never sees phone numbers or contact names. */
export const requestHumanHandoffToolDef: ToolDefinition = {
  name: 'request_human_handoff',
  description: [
    'Connect the customer with a human from the team.',
    'Use it when the customer explicitly asks to talk or call with a person, or after two failed attempts to solve their problem yourself.',
    'Call it only once per conversation topic.',
    'The system sends the customer a button that opens a chat with an available person; you never handle phone numbers.',
  ].join(' '),
  parameters: {
    type: 'object',
    properties: {
      customer_message: {
        type: 'string',
        description: `Short, friendly note for the customer in their language, without any link (max ${HANDOFF_CUSTOMER_MESSAGE_MAX} characters)`,
      },
      prefill_text: {
        type: 'string',
        description: `First-person text the customer will send to the human, in their language, summarizing what they need (max ${HANDOFF_PREFILL_MAX} characters)`,
      },
    },
    required: ['customer_message', 'prefill_text'],
  },
};

/** System prompt block appended when the tool is active. Contains no phones or contact names. */
export const HUMAN_HANDOFF_PROMPT_BLOCK = [
  'You can connect the customer with a human from the team using the request_human_handoff tool.',
  'Call it when the customer explicitly asks to speak with a person, or after two failed attempts to solve their problem.',
  'Do not write phone numbers or links yourself; the system sends a button automatically.',
  'After calling it, keep replying in the customer\'s language, add at most a short closing sentence, and do not offer the handoff again.',
].join(' ');

// ── Pure helpers ──────────────────────────────────────────────────────────────

export interface CalendarHours {
  id?: string;
  timezone: string | null;
  available_days: number[] | null;
  available_hours: { start: string; end: string } | null;
}

export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function handoffReferenceCode(conversationId: string): string {
  return conversationId.replace(/-/g, '').slice(0, 8).toUpperCase();
}

export function buildHandoffUrl(phone: string, prefillText: string, referenceCode: string): string {
  const suffix = ` (Ref: ${referenceCode})`;
  const room = Math.max(0, HANDOFF_FULL_TEXT_MAX - suffix.length);
  const text = prefillText.slice(0, Math.min(HANDOFF_PREFILL_MAX, room)) + suffix;
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(text)}`;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

const WEEKDAY_TO_SPEC: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** Local weekday (1 = Monday … 7 = Sunday) and minutes since midnight in the given timezone. */
function localDayAndMinutes(now: Date, timezone: string): { day: number; minutes: number } {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
  } catch {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
  }
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    day: WEEKDAY_TO_SPEC[get('weekday')] ?? 0,
    minutes: (parseInt(get('hour'), 10) % 24) * 60 + parseInt(get('minute'), 10),
  };
}

/** "Now" falls on an available day of the calendar and inside [start, end) in its timezone. */
export function isWithinCalendarHours(calendar: CalendarHours, now: Date): boolean {
  const days = (Array.isArray(calendar.available_days) ? calendar.available_days : []).map(Number);
  const hours = calendar.available_hours;
  if (!hours?.start || !hours?.end) return false;
  const local = localDayAndMinutes(now, calendar.timezone || 'UTC');
  if (!days.includes(local.day)) return false;
  return local.minutes >= toMinutes(hours.start) && local.minutes < toMinutes(hours.end);
}

/**
 * No calendars (or none of them exist anymore) = always available; otherwise
 * available when "now" is inside ANY of the contact's calendars (union of windows).
 */
export function isContactAvailable(
  contact: Pick<HandoffContact, 'calendarIds'>,
  calendarsById: Map<string, CalendarHours>,
  now: Date
): boolean {
  if (contact.calendarIds.length === 0) return true;
  const existing = contact.calendarIds
    .map((id) => calendarsById.get(id))
    .filter((c): c is CalendarHours => !!c);
  if (existing.length === 0) return true;
  return existing.some((c) => isWithinCalendarHours(c, now));
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function describeCalendarHours(calendar: CalendarHours): string {
  const days = [...new Set((calendar.available_days ?? []).map(Number))]
    .filter((d) => d >= 1 && d <= 7)
    .sort((a, b) => a - b);
  const ranges: string[] = [];
  let i = 0;
  while (i < days.length) {
    let j = i;
    while (j + 1 < days.length && days[j + 1] === days[j]! + 1) j++;
    ranges.push(j > i ? `${DAY_LABELS[days[i]! - 1]}-${DAY_LABELS[days[j]! - 1]}` : DAY_LABELS[days[i]! - 1]!);
    i = j + 1;
  }
  const hours = calendar.available_hours;
  const window = hours?.start && hours?.end ? `${hours.start}-${hours.end}` : '';
  return [ranges.join(', '), window, `(${calendar.timezone || 'UTC'})`].filter(Boolean).join(' ');
}

/**
 * Sticky contact (same conversation) wins while still available; otherwise round-robin
 * over the available list using a 1-based counter (Redis INCR).
 */
export function pickContact(
  available: HandoffContact[],
  stickyContactId: string | null,
  roundRobinCounter: number
): HandoffContact | null {
  if (available.length === 0) return null;
  if (stickyContactId) {
    const sticky = available.find((c) => c.id === stickyContactId);
    if (sticky) return sticky;
  }
  const idx = (((roundRobinCounter - 1) % available.length) + available.length) % available.length;
  return available[idx] ?? null;
}

// ── Execution ─────────────────────────────────────────────────────────────────

export interface HumanHandoffContext {
  conversationId: string;
  agentId: string;
  organizationId: string;
  channel: 'whatsapp' | 'web';
  handoffConfig: HandoffConfig;
  // WhatsApp-specific
  phoneNumberId?: string;
  accessToken?: string;
  contactPhone?: string;
}

export interface HumanHandoffResult {
  success: boolean;
  message: string; // What the LLM sees as tool result
}

const cooldownKey = (conversationId: string) => `handoff:cooldown:${conversationId}`;
const stickyKey = (conversationId: string) => `handoff:contact:${conversationId}`;
const roundRobinKey = (agentId: string) => `handoff:rr:${agentId}`;

export async function handleHumanHandoff(
  args: { customer_message?: unknown; prefill_text?: unknown },
  context: HumanHandoffContext,
  now: Date = new Date()
): Promise<HumanHandoffResult> {
  const { handoffConfig } = context;

  // 1. Validate args and configuration
  const customerMessage = typeof args.customer_message === 'string' ? args.customer_message.trim() : '';
  const prefillText = typeof args.prefill_text === 'string' ? args.prefill_text.trim() : '';
  if (!customerMessage || !prefillText) {
    return { success: false, message: 'Error: customer_message and prefill_text are required.' };
  }
  if (!handoffConfig.enabled || handoffConfig.contacts.length === 0) {
    return {
      success: false,
      message: 'Human handoff is not available right now. Apologize briefly and offer that someone will contact them later.',
    };
  }

  // 2. Cooldown (avoid repeated buttons when the model loops)
  const cooldownSeconds = Math.max(1, handoffConfig.cooldownMinutes) * 60;
  const acquired = await redis.set(cooldownKey(context.conversationId), '1', 'EX', cooldownSeconds, 'NX');
  if (acquired !== 'OK') {
    return {
      success: true,
      message: 'The handoff button was already sent a moment ago. Briefly remind the customer to use the previous button; do not send another.',
    };
  }
  const releaseCooldown = async () => {
    try {
      await redis.del(cooldownKey(context.conversationId));
    } catch {
      // best effort — the key expires on its own
    }
  };

  try {
    // 3. Choose an available contact
    const calendarIds = [...new Set(handoffConfig.contacts.flatMap((c) => c.calendarIds))];
    const calendarsById = new Map<string, CalendarHours>();
    if (calendarIds.length > 0) {
      const calRes = await query<CalendarHours & { id: string }>(
        `SELECT id, timezone, available_days, available_hours
         FROM calendars WHERE id = ANY($1::uuid[]) AND organization_id = $2`,
        [calendarIds, context.organizationId]
      );
      for (const row of calRes.rows) calendarsById.set(row.id, row);
      const missing = calendarIds.filter((id) => !calendarsById.has(id));
      if (missing.length > 0) {
        console.warn(`[human-handoff] ${missing.length} calendar(s) no longer exist for agent ${context.agentId}; ignoring them`);
      }
    }

    const available = handoffConfig.contacts.filter((c) => isContactAvailable(c, calendarsById, now));

    // 4. Nobody available: no button, tell the model the schedule
    if (available.length === 0) {
      await releaseCooldown();
      const schedule = [
        ...new Set(
          handoffConfig.contacts
            .flatMap((c) => c.calendarIds)
            .map((id) => calendarsById.get(id))
            .filter((c): c is CalendarHours => !!c)
            .map(describeCalendarHours)
        ),
      ].join('; ');
      createNotification({
        organizationId: context.organizationId,
        type: 'human_handoff_offhours',
        title: 'Human handoff requested outside office hours',
        message: 'A customer asked to talk to a person but nobody on the team was available.',
        data: { conversationId: context.conversationId, agentId: context.agentId },
      }).catch((err) => console.error('[human-handoff] Failed to create notification:', err));
      return {
        success: false,
        message: `Nobody on the team is available right now. Office hours: ${schedule || 'not specified'}. Tell the customer this, and offer to take their details or schedule a time instead. Do not send a button.`,
      };
    }

    let stickyId: string | null = null;
    try {
      stickyId = await redis.get(stickyKey(context.conversationId));
    } catch {
      stickyId = null;
    }
    let counter = 1;
    if (!(stickyId && available.some((c) => c.id === stickyId))) {
      counter = await redis.incr(roundRobinKey(context.agentId));
    }
    const contact = pickContact(available, stickyId, counter);
    if (!contact) {
      await releaseCooldown();
      return { success: false, message: 'Human handoff is not available right now. Apologize briefly.' };
    }

    // 5. Build the wa.me link
    const code = handoffReferenceCode(context.conversationId);
    const url = buildHandoffUrl(contact.phone, prefillText, code);
    const body = customerMessage.slice(0, HANDOFF_CUSTOMER_MESSAGE_MAX);
    const buttonText = handoffConfig.buttonText;

    // 6. Send
    try {
      if (context.channel === 'whatsapp') {
        if (!context.phoneNumberId || !context.accessToken || !context.contactPhone) {
          throw new Error('WhatsApp context missing (phoneNumberId, accessToken, or contactPhone)');
        }
        await sendCtaUrlMessage(context.phoneNumberId, context.accessToken, context.contactPhone, body, buttonText, url);
      } else if (context.channel !== 'web') {
        throw new Error(`Unsupported channel: ${context.channel}`);
      }
    } catch (sendErr) {
      await releaseCooldown();
      console.error('[human-handoff] Send failed:', (sendErr as Error).message);
      return {
        success: false,
        message: 'Could not send the handoff button. Apologize briefly and offer that someone will contact them later.',
      };
    }

    // From here the customer already has the button: later failures must not undo that.
    const content = context.channel === 'web' ? `${body}\n${url}` : body;
    const metadata = { handoff: { url, buttonText, contactName: contact.name } };

    // 7. Persist the assistant message and notify the dashboard
    try {
      const msgResult = await query<{ id: string; created_at: string }>(
        `INSERT INTO messages (conversation_id, role, content, metadata, created_at)
         VALUES ($1, 'assistant', $2, $3, NOW())
         RETURNING id, created_at`,
        [context.conversationId, content, JSON.stringify(metadata)]
      );
      await query(
        `UPDATE conversations
         SET last_message_at = NOW(), message_count = message_count + 1, updated_at = NOW()
         WHERE id = $1`,
        [context.conversationId]
      );
      try {
        const { getIO } = await import('../config/websocket');
        const io = getIO();
        const msgRow = msgResult.rows[0];
        const payload = {
          conversationId: context.conversationId,
          messages: [{ id: msgRow?.id, role: 'assistant', content, metadata, createdAt: msgRow?.created_at }],
        };
        io.to(`org:${context.organizationId}`).emit('message:new', payload);
        io.to(`conv:${context.conversationId}`).emit('message:new', payload);
      } catch {
        // WebSocket may not be initialized — non-fatal
      }
    } catch (persistErr) {
      console.error('[human-handoff] Failed to persist handoff message:', (persistErr as Error).message);
    }

    // 8. Mark the conversation as handed off and remember the chosen contact
    try {
      await query('UPDATE conversations SET handed_off_at = NOW() WHERE id = $1', [context.conversationId]);
      await redis.set(
        stickyKey(context.conversationId),
        contact.id,
        'EX',
        Math.max(1, handoffConfig.labelTtlHours) * 3600
      );
    } catch (markErr) {
      console.error('[human-handoff] Failed to mark conversation as handed off:', (markErr as Error).message);
    }

    // 9. Notify the owner (non-blocking)
    createNotification({
      organizationId: context.organizationId,
      type: 'human_handoff',
      title: `Conversation handed off to ${contact.name}`,
      message: `A customer was sent a WhatsApp link to ${contact.name} (ref ${code}).`,
      data: {
        conversationId: context.conversationId,
        agentId: context.agentId,
        contactName: contact.name,
        referenceCode: code,
      },
    }).catch((err) => console.error('[human-handoff] Failed to create notification:', err));

    console.log(`[human-handoff] Sent handoff button for conversation ${context.conversationId} (ref ${code}, channel ${context.channel})`);

    // 10. Tell the model
    return {
      success: true,
      message: 'The handoff button was sent to the customer. Do not repeat the link. You may add one short closing sentence, and do not offer the handoff again.',
    };
  } catch (err) {
    await releaseCooldown();
    console.error('[human-handoff] Unexpected error:', (err as Error).message);
    return {
      success: false,
      message: 'Human handoff failed. Apologize briefly and offer that someone will contact them later.',
    };
  }
}
