'use client';

import { PLAN_LIMITS, PRICING } from '@gensmart/shared';
import { useTranslation } from '@/hooks/useTranslation';
import Container from '../../Container';
import Reveal from '../../Reveal';
import Section from '../../Section';
import SectionHead from '../../SectionHead';
import SiteButton from '../../SiteButton';
import styles from './PricingLadderSection.module.css';

const P = 'site.home.pricing';
const STAGGER_MS = 80;

type PlanId = 'solo' | 'starter' | 'pro' | 'enterprise';
const PLANS: Array<{ id: PlanId; name: string; featured?: boolean }> = [
  { id: 'solo', name: 'Solo' },
  { id: 'starter', name: 'Starter' },
  { id: 'pro', name: 'Pro', featured: true },
  { id: 'enterprise', name: 'Enterprise' },
];

export default function PricingLadderSection() {
  const { t, language } = useTranslation();
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

  return (
    <Section surface="alt" className={styles.pricing}>
      <Container>
        <SectionHead title={t(`${P}.title`)} />
        <div className={styles.ladder}>
          {PLANS.map((plan, i) => (
            <Reveal key={plan.id} delay={i * STAGGER_MS} className={styles.cell}>
              <div className={`${styles.plan} ${plan.featured ? styles.featured : ''}`}>
                <span className={styles.name}>{plan.name}</span>
                <div className={styles.price}>
                  <i className={styles.dot} aria-hidden="true" />${PRICING[plan.id].monthly}
                  <small>{t(`${P}.perMonth`)}</small>
                </div>
                <p className={styles.desc}>{describe(plan.id)}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <div className={styles.cta}>
          <SiteButton to="pricing">{t(`${P}.cta`)}</SiteButton>
        </div>
      </Container>
    </Section>
  );
}
