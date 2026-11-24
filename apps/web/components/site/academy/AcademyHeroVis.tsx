import type { SiteLanguage } from '@/lib/site-routes';
import type { ByLang } from './academyData';
import styles from './AcademyHeroVis.module.css';

/**
 * Mini pantalla de ejemplo de la barra lateral del curso (design/web: `heroVis`). Decorativa
 * (`aria-hidden`): son datos ficticios, no una captura. Los textos son parte del dibujo.
 */
export type HeroVisKey = 'agentes' | 'bandeja' | 'crm' | 'agenda';

const b = (es: string, en: string): ByLang => ({ es, en });

const AGENT: readonly [ByLang, ByLang][] = [
  [b('Objetivo', 'Goal'), b('Calificar y agendar una demo', 'Qualify and book a demo')],
  [b('Tono', 'Tone'), b('Cercano y directo', 'Warm and direct')],
  [b('Canal', 'Channel'), b('WhatsApp · Instagram', 'WhatsApp · Instagram')],
  [b('Regla', 'Rule'), b('Si piden descuento, pasa a una persona', 'If they ask for a discount, hand off to a person')],
];

const INBOX: readonly { name: string; ch: 'wa' | 'ig'; text: ByLang; status: ByLang; tone?: 'warn' | 'ok' }[] = [
  { name: 'Laura Gómez', ch: 'wa', text: b('Necesito la factura a nombre de la empresa', 'I need the invoice in the company name'), status: b('Tomada', 'Taken'), tone: 'warn' },
  { name: 'Andrés Pardo', ch: 'ig', text: b('¿La Trail Pro viene en verde?', 'Does the Trail Pro come in green?'), status: b('Activa', 'Active') },
  { name: 'María Restrepo', ch: 'wa', text: b('Perfecto, ya hice el pago', 'Perfect, I just paid'), status: b('Cerrada', 'Closed'), tone: 'ok' },
];

const CRM: readonly [ByLang, ByLang][] = [
  [b('Etapa', 'Stage'), b('Cotización enviada', 'Quote sent')],
  [b('Agente', 'Agent'), b('Ventas', 'Sales')],
  [b('Pidió', 'Asked for'), b('200 uniformes, entrega en marzo', '200 uniforms, delivery in March')],
];

const SLOTS: readonly { time: string; label: ByLang; state: 'taken' | 'free' | 'sel' }[] = [
  { time: '09:00', label: b('Ocupado', 'Taken'), state: 'taken' },
  { time: '10:30', label: b('Libre', 'Free'), state: 'free' },
  { time: '11:30', label: b('Cita confirmada por el agente', 'Booked by the agent'), state: 'sel' },
  { time: '15:00', label: b('Libre', 'Free'), state: 'free' },
];

function Rows({ rows, lang }: { rows: readonly [ByLang, ByLang][]; lang: SiteLanguage }) {
  return (
    <dl className={styles.list}>
      {rows.map(([k, v]) => (
        <div key={k.en}>
          <dt>{k[lang]}</dt>
          <dd>{v[lang]}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function AcademyHeroVis({ name, lang }: { name: HeroVisKey; lang: SiteLanguage }) {
  return (
    <div className={styles.vis} aria-hidden="true">
      {name === 'agentes' ? (
        <>
          <div className={styles.head}>
            <b>{lang === 'es' ? 'Agente de ventas' : 'Sales agent'}</b>
            <span className={styles.on}>{lang === 'es' ? 'Activo' : 'Live'}</span>
          </div>
          <Rows rows={AGENT} lang={lang} />
        </>
      ) : null}
      {name === 'bandeja' ? (
        <>
          <div className={styles.head}>
            <b>{lang === 'es' ? 'Bandeja' : 'Inbox'}</b>
            <span>{lang === 'es' ? 'Todas · 14' : 'All · 14'}</span>
          </div>
          <ul className={styles.rows}>
            {INBOX.map((r) => (
              <li key={r.name}>
                <i className={r.ch === 'ig' ? styles.ig : undefined} />
                <span>
                  <b>{r.name}</b>
                  {r.text[lang]}
                </span>
                <em className={r.tone ? styles[r.tone] : undefined}>{r.status[lang]}</em>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {name === 'crm' ? (
        <>
          <div className={styles.head}>
            <b>Laura Gómez</b>
            <span>WhatsApp</span>
          </div>
          <div className={styles.score}>
            <strong>8.4</strong>
            <span className={styles.scoreBar}>
              <i />
            </span>
          </div>
          <Rows rows={CRM} lang={lang} />
        </>
      ) : null}
      {name === 'agenda' ? (
        <>
          <div className={styles.head}>
            <b>{lang === 'es' ? 'Jueves' : 'Thursday'}</b>
            <span>{lang === 'es' ? 'Agenda' : 'Calendar'}</span>
          </div>
          <ul className={styles.slots}>
            {SLOTS.map((s) => (
              <li key={s.time} className={styles[s.state]}>
                {s.time}
                <span>{s.label[lang]}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
