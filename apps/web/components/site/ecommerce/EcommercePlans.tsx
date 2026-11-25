'use client';

import { useState } from 'react';
import { PRICING } from '@gensmart/shared';
import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import { registerHref } from '@/lib/site-links';
import Container from '../Container';
import Reveal from '../Reveal';
import SalesDialog from '../SalesDialog';
import Section from '../Section';
import SectionHead from '../SectionHead';
import SiteButton, { SiteActionButton } from '../SiteButton';
import { SITE_TRIAL_DAYS } from '../siteTrial';
import {
  FEATURED_PLAN,
  PLAN_IDS,
  PLAN_NAMES,
  formatPrice,
  joinList,
  planFeatures,
  trialPlanNames,
  type PlanId,
} from '../pricing/pricingData';
import { E } from './ecommerceData';
import styles from './EcommercePlans.module.css';

const P = 'site.pricing';

/** Primera letra en minúscula para encadenar en una frase ("Contactos ilimitados" → "contactos…"). */
function lowerFirst(text: string, lang: string): string {
  return text.charAt(0).toLocaleLowerCase(lang) + text.slice(1);
}

/**
 * "Tu primer agente, desde $X USD al mes" (design/web: `.ladder`, `.prow`).
 * Todo sale de los datos de Precios: precios, nombres, plan recomendado, la línea
 * de cada plan (agentes, mensajes y contactos de `PLAN_LIMITS`) y los días de prueba.
 * Enterprise no tiene prueba: abre `SalesDialog`.
 */
export default function EcommercePlans() {
  const { t, language } = useSiteTranslation();
  const [salesOpen, setSalesOpen] = useState(false);
  const k = `${E}.plans`;
  const trialCta = t(`${P}.trialCta`, { days: SITE_TRIAL_DAYS });

  const line = (id: PlanId) => {
    const [agents, messages, contacts] = planFeatures(id, t, language);
    const parts = [agents, messages, contacts].filter((x): x is string => Boolean(x));
    return joinList(
      parts.map((part, i) => (i === 0 ? part : lowerFirst(part, language))),
      t(`${P}.and`)
    );
  };

  return (
    <Section surface="dark" rhythm="s">
      <Container>
        <SectionHead
          title={t(`${k}.title`, { price: formatPrice(language, PRICING.solo.monthly) })}
          lead={`${t(`${k}.lead`, { days: SITE_TRIAL_DAYS, plans: trialPlanNames(t) })} ${t(`${k}.leadSales`)}`}
        />
        <div className={styles.ladder}>
          {PLAN_IDS.map((id) => {
            const featured = id === FEATURED_PLAN;
            return (
              <Reveal key={id} className={`${styles.row} ${featured ? styles.featured : ''}`}>
                {featured ? <span className={styles.badge}>{t(`${P}.recommended`)}</span> : null}
                <span className={styles.tag}>{PLAN_NAMES[id]}</span>
                <p className={styles.price}>
                  <i aria-hidden="true" />${formatPrice(language, PRICING[id].monthly)}
                  <small>{t(`${P}.perMonth`)}</small>
                </p>
                <p className={styles.line}>{line(id)}</p>
                {id === 'enterprise' ? (
                  <SiteActionButton
                    variant="ghost"
                    size="sm"
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
                    size="sm"
                    className={styles.cta}
                    aria-label={`${trialCta}: ${PLAN_NAMES[id]}`}
                  >
                    {trialCta}
                  </SiteButton>
                )}
              </Reveal>
            );
          })}
        </div>
        <div className={styles.more}>
          <SiteButton to="pricing" variant="ghost">
            {t(`${k}.details`)}
          </SiteButton>
        </div>
      </Container>
      <SalesDialog open={salesOpen} onClose={() => setSalesOpen(false)} />
    </Section>
  );
}
