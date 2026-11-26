import type { Block } from '../layout';
import { renderEmail } from '../layout';
import { APP_PATHS, webUrl } from '../links';
import { capitalize, formatAppointment } from '../parts';
import { getStrings } from '../strings';
import type { EmailLang, RenderedEmail } from '../types';

export interface AppointmentNewEmailData {
  personName: string;
  /** `YYYY-MM-DD` y `HH:MM`, hora local del calendario. */
  date: string;
  time: string;
  calendarName: string;
  phone?: string | null;
  summary?: string | null;
}

/** Cita nueva, a la dirección de avisos del calendario. */
export function appointmentNewEmail(data: AppointmentNewEmailData, lang: EmailLang): RenderedEmail {
  const s = getStrings(lang).appointmentNew;
  const when = formatAppointment(data.date, data.time, lang);
  const blocks: Block[] = [
    { type: 'heading', text: s.heading },
    { type: 'paragraph', parts: [s.body(data.calendarName)] },
    {
      type: 'details',
      rows: [
        { label: s.customer, value: data.personName },
        { label: s.date, value: capitalize(when.date) },
        { label: s.time, value: when.time },
        { label: s.calendar, value: data.calendarName },
        { label: s.phone, value: data.phone?.trim() || s.noPhone },
      ],
    },
  ];
  if (data.summary?.trim()) blocks.push({ type: 'panel', title: s.topic, text: data.summary.trim() });
  blocks.push({ type: 'button', label: s.cta, href: webUrl(APP_PATHS.calendar) });
  return renderEmail({
    lang,
    subject: s.subject(data.personName, when.date, when.time),
    preheader: s.preheader(data.calendarName),
    footerReason: s.footer(data.calendarName),
    blocks,
  });
}
