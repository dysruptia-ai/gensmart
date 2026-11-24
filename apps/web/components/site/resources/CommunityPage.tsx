'use client';

import { Heart, MessageCircle, ShoppingCart, Sparkles, Users, type LucideIcon } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { contactVariantHref } from '@/lib/site-links';
import { isSiteLanguage } from '@/lib/site-routes';
import ChatBubble from '../ChatBubble';
import Container from '../Container';
import PageHero from '../PageHero';
import Section from '../Section';
import SectionHead from '../SectionHead';
import SiteButton from '../SiteButton';
import SiteLogo from '../SiteLogo';
import { C, COMMUNITY_CRUMBS, HOW_ID, communityFaqItems } from './resourcesData';
import styles from './CommunityPage.module.css';

/** Grupos de la maqueta: icono y si es de solo lectura (design/web: `GRP`). */
const GROUPS: readonly { icon: LucideIcon; locked: boolean }[] = [
  { icon: Sparkles, locked: true },
  { icon: MessageCircle, locked: false },
  { icon: ShoppingCart, locked: false },
  { icon: Heart, locked: false },
  { icon: Users, locked: false },
];

const STEP_COUNT = 3;
const RULE_COUNT = 5;
const DIRECTIONS = ['in', 'out', 'in'] as const;

/** Comunidad (design/web: `comunidad`). */
export default function CommunityPage() {
  const { t, language } = useTranslation();
  const lang = isSiteLanguage(language) ? language : 'en';
  const contact = contactVariantHref(lang, 'comunidad');

  const example = (kind: 'bad' | 'good') => (
    <figure className={kind === 'good' ? `${styles.example} ${styles.good}` : styles.example}>
      <figcaption className={styles.exampleHead}>
        <b>{t(`${C}.ask.${kind}.title`)}</b>
        <span>{t(`${C}.ask.example`)}</span>
      </figcaption>
      <ol className={styles.chat}>
        {DIRECTIONS.map((direction, i) => (
          <li key={i}>
            <ChatBubble direction={direction} className={styles.msg}>
              {t(`${C}.ask.${kind}.msgs.${i}`)}
            </ChatBubble>
          </li>
        ))}
      </ol>
      <p className={styles.exampleNote}>{t(`${C}.ask.${kind}.note`)}</p>
    </figure>
  );

  return (
    <>
      <PageHero
        crumbs={COMMUNITY_CRUMBS}
        title={{ before: t(`${C}.hero.titleBefore`), accent: t(`${C}.hero.titleAccent`) }}
        lead={t(`${C}.hero.lead`)}
        actions={<SiteButton href={contact}>{t(`${C}.hero.primary`)}</SiteButton>}
      />

      <Section surface="dark" id={HOW_ID[lang]}>
        <Container className={styles.split}>
          <div>
            <SectionHead title={t(`${C}.how.title`)} lead={t(`${C}.how.lead`)} />
            <ol className={`${styles.rules} ${styles.steps}`}>
              {Array.from({ length: STEP_COUNT }, (_, i) => (
                <li key={i}>
                  <b>{t(`${C}.how.steps.${i}.title`)}</b> {t(`${C}.how.steps.${i}.text`)}
                </li>
              ))}
            </ol>
          </div>
          <div className={styles.phone} role="group" aria-label={t(`${C}.how.mockLabel`)}>
            <div className={styles.bar}>
              <span className={styles.avatar} aria-hidden="true">
                <SiteLogo variant="mark" to={null} />
              </span>
              <span>
                <b>{t(`${C}.how.mockName`)}</b>
                <small>{t(`${C}.how.mockSub`)}</small>
              </span>
            </div>
            <ul className={styles.groups}>
              {GROUPS.map(({ icon: Icon, locked }, i) => (
                <li key={i} className={locked ? `${styles.group} ${styles.locked}` : styles.group}>
                  <span className={styles.groupIcon} aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <span className={styles.groupText}>
                    <b>{t(`${C}.how.groups.${i}.name`)}</b>
                    <small>{t(`${C}.how.groups.${i}.text`)}</small>
                  </span>
                  <em className={styles.groupTag}>{t(`${C}.how.groups.${i}.tag`)}</em>
                </li>
              ))}
            </ul>
            <p className={styles.foot}>{t(`${C}.how.foot`)}</p>
          </div>
        </Container>
      </Section>

      <Section surface="alt">
        <Container>
          <SectionHead title={t(`${C}.ask.title`)} lead={t(`${C}.ask.lead`)} />
          <div className={styles.examples}>
            {example('bad')}
            {example('good')}
          </div>
        </Container>
      </Section>

      <Section surface="dark">
        <Container>
          <p className={styles.kicker}>{t(`${C}.rules.kicker`)}</p>
          <SectionHead title={t(`${C}.rules.title`)} />
          <ol className={styles.rules}>
            {Array.from({ length: RULE_COUNT }, (_, i) => (
              <li key={i}>
                <b>{t(`${C}.rules.items.${i}.title`)}</b> {t(`${C}.rules.items.${i}.text`)}
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      <Section surface="alt">
        <Container className={`${styles.split} ${styles.splitTop}`}>
          <div>
            <SectionHead title={t(`${C}.not.title`)} lead={t(`${C}.not.lead`)} />
            <div className={styles.actions}>
              <SiteButton to="contact" variant="ghost">
                {t(`${C}.not.primary`)}
              </SiteButton>
              <SiteButton to="resources" variant="ghost">
                {t(`${C}.not.secondary`)}
              </SiteButton>
            </div>
          </div>
          <dl className={styles.faq}>
            {communityFaqItems(t).map((item) => (
              <div key={item.question}>
                <dt>{item.question}</dt>
                <dd>{item.answer}</dd>
              </div>
            ))}
          </dl>
        </Container>
        <Container>
          <div className={styles.note}>
            <p>
              <strong>{t(`${C}.not.noteStrong`)}</strong> {t(`${C}.not.noteText`)}
            </p>
          </div>
        </Container>
      </Section>
    </>
  );
}
