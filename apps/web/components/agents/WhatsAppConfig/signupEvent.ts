// Parsing of the Embedded Signup session message posted by the Facebook popup.
// Keep this module free of promise-style constructs: it is reachable from the
// login callback closure, which the SDK scans for certain keywords.

export type SignupEvent = {
  event: string;
  waba_id?: string;
  phone_number_id?: string;
  business_id?: string;
  waba_ids?: string[];
  current_step?: string;
  error_message?: string;
  error_id?: string;
};

const ID_PATTERN = /^\d{5,30}$/;
const FINISH_EVENTS = ['FINISH', 'FINISH_ONLY_WABA', 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'];
const ABORT_EVENTS = ['CANCEL', 'ERROR'];

export function isFacebookOrigin(origin: string): boolean {
  try {
    const hostname = new URL(origin).hostname;
    return hostname === 'facebook.com' || hostname.endsWith('.facebook.com');
  } catch {
    return false;
  }
}

function asId(value: unknown): string | undefined {
  return typeof value === 'string' && ID_PATTERN.test(value) ? value : undefined;
}

export function parseSignupMessage(evt: MessageEvent): SignupEvent | null {
  if (!isFacebookOrigin(evt.origin)) return null;

  let raw: unknown = evt.data;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== 'object') return null;

  const msg = raw as { type?: unknown; event?: unknown; data?: unknown };
  if (msg.type !== 'WA_EMBEDDED_SIGNUP') return null;
  if (typeof msg.event !== 'string' || msg.event.length === 0 || msg.event.length > 64) return null;

  const result: SignupEvent = { event: msg.event };
  const data = msg.data && typeof msg.data === 'object' ? (msg.data as Record<string, unknown>) : {};

  const wabaId = asId(data['waba_id']);
  if (wabaId) result.waba_id = wabaId;
  const phoneId = asId(data['phone_number_id']);
  if (phoneId) result.phone_number_id = phoneId;
  const businessId = asId(data['business_id']);
  if (businessId) result.business_id = businessId;

  if (Array.isArray(data['waba_ids'])) {
    const ids = (data['waba_ids'] as unknown[]).map(asId).filter((id): id is string => !!id);
    if (ids.length > 0) result.waba_ids = ids.slice(0, 20);
  }

  if (typeof data['current_step'] === 'string') {
    const step = data['current_step'].replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
    if (step) result.current_step = step;
  }
  if (typeof data['error_id'] === 'string') {
    const errorId = data['error_id'].replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
    if (errorId) result.error_id = errorId;
  }
  if (typeof data['error_message'] === 'string') {
    // eslint-disable-next-line no-control-regex
    const message = data['error_message'].replace(/[\u0000-\u001f\u007f-\u009f]/g, '').slice(0, 200);
    if (message) result.error_message = message;
  }

  return result;
}

export function isFinishEvent(e: SignupEvent): boolean {
  return FINISH_EVENTS.includes(e.event);
}

export function isAbortEvent(e: SignupEvent): boolean {
  return ABORT_EVENTS.includes(e.event);
}
