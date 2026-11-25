'use client';

import { useState } from 'react';
import { PLAN_LIMITS, PRICING } from '@gensmart/shared';
import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import { registerHref, type RegisterPlan } from '@/lib/site-links';
import Container from '../../Container';
import Reveal from '../../Reveal';
import SalesDialog from '../../SalesDialog';
import Section from '../../Section';
import SectionHead from '../../SectionHead';
import SiteButton, { SiteActionButton } from '../../SiteButton';
import { SITE_TRIAL_DAYS } from '../../siteTrial';
import styles from './PricingLadderSection.module.css';

const P = 'site.home.pricing';
const STAGGER_MS = 80;

type PlanId = RegisterPlan | 'enterprise';
const PLANS: Array<{ id: PlanId; name: string; featured?: boolean }> = [
  { id: 'solo', name: 'Solo' },
  { id: 'starter', name: 'Starter' },
  { id: 'pro', name: 'Pro', featured: true },
  { id: 'enterprise', name: 'Enterprise' },
];

export default function PricingLadderSection() {
  const { t, language } = useSiteTranslation();
  const [salesOpen, setSalesOpen] = useState(false);
  // useGrouping 'always': en español 1.000 y 5.000 (por defecto 'es' no agrupa los 4 dígitos)
  const nf = new Intl.NumberFormat(language, { useGrouping: 'always' });

  const describe = (id: PlanId): string => {
    const limits = PLAN_LIMITS[id];
    switch (id) {
      case 'solo':
      case 'starter':
        return t(`${P}.${id}Desc`, {
          agents: nf.format(limits.agents),
          messages: nf.format(limits.messagesPerMonth),
          contacts: nf.format(limits.contacts),
        });
      case 'pro':
        return t(`${P}.proDesc`, {
          agents: nf.format(limits.agents),
          messages: nf.format(limits.messagesPerMonth),
        });
      case 'enterprise':
        // Texto fijo: solo es válido mientras el plan sea ilimitado y con llave propia
        return limits.agents === Infinity && limits.byoApiKey
          ? t(`${P}.enterpriseDesc`)
          : t(`${P}.proDesc`, {
              agents: nf.format(limits.agents),
              messages: nf.format(limits.messagesPerMonth),
            });
    }
  };

  const trialCta = t(`${P}.trialCta`, { days: SITE_TRIAL_DAYS });

  return (
    <Section surface="dark" className={styles.pricing}>
      <Container>
        <SectionHead
          title={t(`${P}.title`, { price: PRICING.solo.monthly })}
          lead={t(`${P}.lead`, { days: SITE_TRIAL_DAYS })}
        />
        <div className={styles.ladder}>
          {PLANS.map((plan, i) => (
            <Reveal key={plan.id} delay={i * STAGGER_MS} className={styles.cell}>
              <div className={`${styles.plan} ${plan.featured ? styles.featured : ''}`}>
                <div className={styles.head}>
                  <span className={styles.name}>{plan.name}</span>
                  {plan.featured ? <span className={styles.badge}>{t(`${P}.recommended`)}</span> : null}
                </div>
                <div className={styles.price}>
                  <i className={styles.dot} aria-hidden="true" />${PRICING[plan.id].monthly}
                  <small>{t(`${P}.perMonth`)}</small>
                </div>
                <p className={styles.desc}>{describe(plan.id)}</p>
                {plan.id === 'enterprise' ? (
                  // Enterprise no es autoservicio: va a ventas, igual que en la página de precios
                  <SiteActionButton
                    size="sm"
                    className={styles.planCta}
                    aria-haspopup="dialog"
                    onClick={() => setSalesOpen(true)}
                  >
                    {t(`${P}.salesCta`)}
                  </SiteActionButton>
                ) : (
                  <SiteButton href={registerHref(plan.id)} size="sm" className={styles.planCta}>
                    {trialCta}
                  </SiteButton>
                )}
              </div>
            </Reveal>
          ))}
        </div>
        <div className={styles.cta}>
          <SiteButton to="pricing" variant="ghost">
            {t(`${P}.cta`)}
          </SiteButton>
        </div>
      </Container>
      <SalesDialog open={salesOpen} onClose={() => setSalesOpen(false)} />
    </Section>
  );
}
