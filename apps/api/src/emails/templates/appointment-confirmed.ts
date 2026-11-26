import type { Block } from '../layout';
import { renderEmail } from '../layout';
import { capitalize, formatAppointment } from '../parts';
import { getStrings } from '../strings';
import type { EmailLang, RenderedEmail } from '../types';

export interface AppointmentConfirmedEmailData {
  contactName: string;
  /** Nombre del negocio (la organización). */
  businessName: string;
  calendarName: string;
  /** `YYYY-MM-DD` y `HH:MM`, hora local del calendario. */
  date: string;
  time: string;
  /** ISO, para el enlace de Google Calendar. */
  startTime: string;
  endTime: string;
  summary?: string | null;
}

function gcalStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Cita confirmada, al cliente final: la envía GenSmart en nombre del negocio. */
export function appointmentConfirmedEmail(data: AppointmentConfirmedEmailData, lang: EmailLang): RenderedEmail {
  const s = getStrings(lang).appointmentConfirmed;
  const when = formatAppointment(data.date, data.time, lang);
  const summary = data.summary?.trim() ?? '';
  const gcal = new URL('https://calendar.google.com/calendar/render');
  gcal.searchParams.set('action', 'TEMPLATE');
  gcal.searchParams.set('text', s.eventTitle(data.businessName));
  gcal.searchParams.set('dates', `${gcalStamp(data.startTime)}/${gcalStamp(data.endTime)}`);
  if (summary) gcal.searchParams.set('details', summary);

  const blocks: Block[] = [
    { type: 'heading', text: s.heading },
    { type: 'paragraph', parts: [s.bodyBefore(data.contactName), { bold: data.businessName }, s.bodyAfter] },
    {
      type: 'details',
      rows: [
        { label: s.date, value: capitalize(when.date) },
        { label: s.time, value: when.time },
        { label: s.with, value: `${data.businessName} · ${data.calendarName}` },
      ],
    },
  ];
  if (summary) blocks.push({ type: 'panel', title: s.topic, text: summary });
  blocks.push(
    { type: 'button', label: s.cta, href: gcal.toString() },
    { type: 'bullets', title: s.beforeTitle, items: [s.before1, s.before2, s.before3] },
    { type: 'paragraph', parts: [s.reschedule(data.businessName)], small: true }
  );
  return renderEmail({
    lang,
    subject: s.subject(when.date, when.time),
    preheader: s.preheader,
    footerReason: s.footer(data.businessName),
    blocks,
  });
}
