'use client';

import { useId, useState, type ReactNode } from 'react';
import { Check, Clock, ShoppingBag } from 'lucide-react';
import { PRICING } from '@gensmart/shared';
import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import Container from '../Container';
import Section from '../Section';
import SectionHead from '../SectionHead';
import SiteButton from '../SiteButton';
import { PLAN_NAMES, formatNumber, formatPrice } from '../pricing/pricingData';
import { CALC_ID, E, PLAN_PRICES, calculate, formatPercent, type CalcInput } from './ecommerceData';
import styles from './EcommerceCalculator.module.css';

type FieldKey = keyof CalcInput;

/** Los 5 campos, en el orden del diseño. `max` solo en los porcentajes. */
const FIELDS: readonly { key: FieldKey; n: number; max?: number; decimal?: boolean }[] = [
  { key: 'conversations', n: 1 },
  { key: 'buyPer100', n: 2, max: 100, decimal: true },
  { key: 'ticket', n: 3, decimal: true },
  { key: 'latePercent', n: 4, max: 100, decimal: true },
  { key: 'minutes', n: 5, decimal: true },
];

const EMPTY: Record<FieldKey, string> = {
  conversations: '',
  buyPer100: '',
  ticket: '',
  latePercent: '',
  minutes: '',
};

const DASH = '–';

/** Texto del campo → número (vacío o inválido = `null`), sin negativos y con tope en los %. */
function parse(raw: string, max?: number): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const clamped = Math.max(0, n);
  return max === undefined ? clamped : Math.min(clamped, max);
}

/**
 * "Lo que cambia cuando tu agente responde a tiempo" (design/web: `.ecalc`).
 * Aritmética en el navegador con los supuestos del visitante: no se envía ni se guarda nada.
 * El HTML del servidor trae la calculadora vacía (todos los resultados en "–").
 */
export default function EcommerceCalculator() {
  const { t, language } = useSiteTranslation();
  const uid = useId();
  const [values, setValues] = useState<Record<FieldKey, string>>(EMPTY);
  const k = `${E}.calc`;

  const input = Object.fromEntries(FIELDS.map((f) => [f.key, parse(values[f.key], f.max)])) as unknown as CalcInput;
  const { lost, hours, orders, payoffPlan } = calculate(input);

  const money = (n: number) => `$${formatPrice(language, Math.round(n))}`;
  const pct = (ratio: number) => formatPercent(language, Math.ceil(ratio * 100));

  let loss: ReactNode = t(`${k}.lossEmpty`);
  if (lost !== null && payoffPlan !== null) {
    const price = PRICING[payoffPlan].monthly;
    const ratio = price / lost;
    loss = (
      <>
        {t(`${k}.lossBefore`)} <b>{money(lost)}</b>{' '}
        {t(`${k}.lossAfter`, {
          plan: PLAN_NAMES[payoffPlan],
          price: formatPrice(language, price),
          share: ratio < 0.01 ? t(`${k}.lossShareUnder`) : t(`${k}.lossShare`, { pct: pct(ratio) }),
        })}
      </>
    );
  }

  return (
    <Section surface="light" id={CALC_ID} className={styles.section}>
      <Container>
        <SectionHead title={t(`${k}.title`)} lead={t(`${k}.lead`)} />
        <div className={styles.calc}>
          <form className={styles.form} aria-label={t(`${k}.formLabel`)} onSubmit={(e) => e.preventDefault()}>
            {FIELDS.map((f) => {
              const id = `${uid}-f${f.n}`;
              return (
                <div key={f.key} className={styles.field}>
                  <label htmlFor={id}>{t(`${k}.f${f.n}.label`)}</label>
                  <input
                    id={id}
                    className={styles.input}
                    type="number"
                    min="0"
                    max={f.max}
                    step="any"
                    inputMode={f.decimal ? 'decimal' : 'numeric'}
                    placeholder="0"
                    aria-describedby={`${id}-help`}
                    value={values[f.key]}
                    onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  />
                  <small id={`${id}-help`}>{t(`${k}.f${f.n}.help`)}</small>
                </div>
              );
            })}
          </form>

          <div className={styles.out} role="region" aria-label={t(`${k}.resultsLabel`)} aria-live="polite">
            <div className={styles.card}>
              <ShoppingBag className={styles.ic} aria-hidden="true" />
              <span className={styles.key}>{t(`${k}.escapeK`)}</span>
              <strong>{lost === null ? DASH : money(lost)}</strong>
              <small>{t(`${k}.escapeHelp`)}</small>
            </div>
            <div className={styles.card}>
              <Clock className={styles.ic} aria-hidden="true" />
              <span className={styles.key}>{t(`${k}.hoursK`)}</span>
              <strong>{hours === null ? DASH : t(`${k}.hours`, { h: formatNumber(language, hours) })}</strong>
              <small>
                {hours === null
                  ? t(`${k}.hoursHelp`)
                  : t(`${k}.hoursHelpN`, { h: formatNumber(language, hours * 0.1) })}
              </small>
            </div>
            <div className={styles.card}>
              <Check className={styles.ic} aria-hidden="true" />
              <span className={styles.key}>{t(`${k}.plansK`)}</span>
              <ul className={styles.plans}>
                {PLAN_PRICES.map((p) => {
                  const n = orders ? orders[p.id] : null;
                  return (
                    <li key={p.id}>
                      <span>
                        {p.name} <i>${formatPrice(language, p.price)}</i>
                      </span>
                      <b>
                        {n === null
                          ? DASH
                          : t(n === 1 ? `${k}.orderOne` : `${k}.orderMany`, { n: formatNumber(language, n) })}
                      </b>
                      {lost !== null ? (
                        <em>
                          {p.price / lost < 0.01
                            ? t(`${k}.shareUnder`)
                            : t(`${k}.share`, { pct: pct(p.price / lost) })}
                        </em>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className={`${styles.card} ${styles.loss}`}>
              <span className={styles.key}>{t(`${k}.lossK`)}</span>
              <p>{loss}</p>
            </div>
            <p className={styles.cta}>
              <SiteButton to="register">{t(`${k}.cta`)}</SiteButton>
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}
