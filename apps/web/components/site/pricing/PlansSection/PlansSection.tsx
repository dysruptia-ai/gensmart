'use client';

import { useState } from 'react';
import { PLAN_LIMITS } from '@gensmart/shared';
import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import { registerHref } from '@/lib/site-links';
import Container from '../../Container';
import SalesDialog from '../../SalesDialog';
import SiteButton, { SiteActionButton } from '../../SiteButton';
import SiteLink from '../../SiteLink';
import { SITE_TRIAL_DAYS } from '../../siteTrial';
import {
  FEATURED_PLAN,
  METER_TOTAL_DOTS,
  PLAN_IDS,
  PLAN_NAMES,
  YEARLY_DISCOUNT_PERCENT,
  channelList,
  planFeatures,
  planMeter,
  formatPrice,
  pricePerMonth,
  trialPlanNames,
  type Billing,
} from '../pricingData';
import styles from './PlansSection.module.css';

const P = 'site.pricing';
const BILLINGS: readonly Billing[] = ['monthly', 'yearly'];

export default function PlansSection() {
  const { t, language } = useSiteTranslation();
  // Mensual por defecto: es lo que trae el HTML del servidor
  const [billing, setBilling] = useState<Billing>('monthly');
  const [salesOpen, setSalesOpen] = useState(false);
  const discount = YEARLY_DISCOUNT_PERCENT;

  return (
    <section className={styles.plansSection} aria-labelledby="plans-heading">
      <Container>
        <h2 id="plans-heading" className={styles.srOnly}>
          {t(`${P}.plansHeading`)}
        </h2>
        <div className={styles.billing} role="group" aria-label={t(`${P}.billingLabel`)}>
          {BILLINGS.map((option) => (
            <button
              key={option}
              type="button"
              className={styles.billingBtn}
              aria-pressed={billing === option}
              onClick={() => setBilling(option)}
            >
              {t(`${P}.${option}`, { discount })}
            </button>
          ))}
        </div>

        <div className={styles.plans}>
          {PLAN_IDS.map((id) => {
            const featured = id === FEATURED_PLAN;
            const meter = planMeter(id);
            const nameId = `plan-${id}`;
            return (
              <article
                key={id}
                className={`${styles.plan} ${featured ? styles.featured : ''}`}
                aria-labelledby={nameId}
              >
                <div className={styles.head}>
                  <h3 id={nameId} className={styles.name}>
                    {PLAN_NAMES[id]}
                  </h3>
                  {featured ? <span className={styles.badge}>{t(`${P}.recommended`)}</span> : null}
                </div>
                <p className={styles.who}>{t(`${P}.who.${id}`)}</p>
                <div>
                  <p className={styles.price}>
                    <i className={styles.dot} aria-hidden="true" />${formatPrice(language, pricePerMonth(id, billing))}
                    <small>{t(`${P}.perMonth`)}</small>
                  </p>
                  {billing === 'yearly' ? (
                    <p className={styles.yearNote}>{t(`${P}.yearlyNote`, { discount })}</p>
                  ) : null}
                </div>
                <div className={styles.meter} aria-hidden="true">
                  <div className={styles.meterRow}>
                    <span>{t(`${P}.meterAgents`)}</span>
                    <span className={styles.dots}>
                      {Array.from({ length: METER_TOTAL_DOTS }, (_, i) => (
                        <i key={i} className={i < meter.agentDots ? styles.on : undefined} />
                      ))}
                    </span>
                  </div>
                  <div className={styles.meterRow}>
                    <span>{t(`${P}.meterMessages`)}</span>
                    <span className={styles.bar}>
                      {/* Ancho dinámico: único estilo en línea, calculado desde PLAN_LIMITS */}
                      <b style={{ width: `${meter.messagesPercent}%` }} />
                    </span>
                  </div>
                </div>
                <ul className={styles.feats}>
                  {planFeatures(id, t, language).map((feature) => (
                    <li key={feature}>
                      <span aria-hidden="true">›</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                {id === 'enterprise' ? (
                  <SiteActionButton
                    variant="ghost"
                    className={styles.cta}
                    aria-haspopup="dialog"
                    onClick={() => setSalesOpen(true)}
                  >
                    {t(`${P}.salesCta`)}
                  </SiteActionButton>
                ) : (
                  <SiteButton
                    href={registerHref(id)}
                    variant={featured ? 'primary' : 'ghost'}
                    className={styles.cta}
                    aria-label={`${t(`${P}.trialCta`, { days: SITE_TRIAL_DAYS })}: ${PLAN_NAMES[id]}`}
                  >
                    {t(`${P}.trialCta`, { days: SITE_TRIAL_DAYS })}
                  </SiteButton>
                )}
              </article>
            );
          })}
        </div>

        <p className={styles.note}>
          {t(`${P}.noteTrial`, { days: SITE_TRIAL_DAYS, plans: trialPlanNames(t) })}{' '}
          {t(`${P}.noteChange`)} {t(`${P}.noteYearly`, { discount })}{' '}
          {t(`${P}.noteChannels`, { n: PLAN_LIMITS.enterprise.channels.length, list: channelList(t) })}{' '}
          {t(`${P}.noteHelp`)} <SiteLink to="contact">{t(`${P}.noteHelpLink`)}</SiteLink>.
        </p>
      </Container>
      <SalesDialog open={salesOpen} onClose={() => setSalesOpen(false)} />
    </section>
  );
}
