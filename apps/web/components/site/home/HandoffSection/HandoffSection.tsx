'use client';

import { useTranslation } from '@/hooks/useTranslation';
import ChatBubble from '../../ChatBubble';
import CheckList from '../../CheckList';
import Container from '../../Container';
import Section from '../../Section';
import SectionHead from '../../SectionHead';
import SiteButton from '../../SiteButton';
import styles from './HandoffSection.module.css';

const P = 'site.home.handoff';

const BUBBLES: Array<{ key: string; out: boolean }> = [
  { key: 'b1', out: false },
  { key: 'b2', out: true },
  { key: 'b3', out: false },
  { key: 'b4', out: true },
];

const ROWS = [
  ['dtChannel', 'ddChannel'],
  ['dtStage', 'ddStage'],
  ['dtScore', 'ddScore'],
  ['dtValue', 'ddValue'],
] as const;

export default function HandoffSection() {
  const { t } = useTranslation();
  return (
    <Section surface="light" className={styles.handoff}>
      <Container>
        <SectionHead title={t(`${P}.title`)} lead={t(`${P}.lead`)} />

        {/* Fila 1: texto primero en el DOM; en desktop la tarjeta va a la izquierda con order */}
        <div className={`${styles.row} ${styles.rowOne}`}>
          <div>
            <h3 className={styles.h3}>{t(`${P}.r1Title`)}</h3>
            <p className={styles.text}>{t(`${P}.r1Text`)}</p>
            <CheckList
              className={styles.checks}
              items={[t(`${P}.r1Check1`), t(`${P}.r1Check2`), t(`${P}.r1Check3`)]}
            />
            <div className={styles.btn}>
              <SiteButton to="ecommerce" variant="ghost">
                {t(`${P}.r1Cta`)}
              </SiteButton>
            </div>
          </div>

          <div className={`${styles.chat} ${styles.cardOne}`} role="group" aria-label={t(`${P}.chatLabel`)}>
            <div className={styles.chatHead}>
              <i className={styles.headDot} />
              <span>{t(`${P}.chatHead`)}</span>
            </div>
            {BUBBLES.map((b) => (
              <ChatBubble key={b.key} direction={b.out ? 'out' : 'in'} tone="onGround">
                {t(`${P}.${b.key}`)}
              </ChatBubble>
            ))}
            <div className={styles.chips}>
              <span className={styles.chip}>{t(`${P}.chip1`)}</span>
              <span className={`${styles.chip} ${styles.chipOn}`}>{t(`${P}.chip2`)}</span>
            </div>
          </div>
        </div>

        {/* Fila 2 */}
        <div className={`${styles.row} ${styles.rowTwo}`}>
          <div>
            <h3 className={styles.h3}>{t(`${P}.r2Title`)}</h3>
            <p className={styles.text}>{t(`${P}.r2Text`)}</p>
            <CheckList
              className={styles.checks}
              items={[t(`${P}.r2Check1`), t(`${P}.r2Check2`), t(`${P}.r2Check3`)]}
            />
          </div>

          <div className={styles.hoff} role="group" aria-label={t(`${P}.handLabel`)}>
            <div className={styles.hoffTop}>
              <i className={styles.topDot} />
              <span>{t(`${P}.handHead`)}</span>
            </div>
            <div className={styles.hoffBody}>
              <p className={styles.summary}>{t(`${P}.summary`)}</p>
              <dl className={styles.rows}>
                {ROWS.map(([dt, dd]) => (
                  <div key={dt}>
                    <dt>{t(`${P}.${dt}`)}</dt>
                    <dd>{t(`${P}.${dd}`)}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className={styles.hoffFoot}>
              <span className={styles.avatar}>CM</span>
              <span className={styles.who}>
                <b>{t(`${P}.who`)}</b>
                <span>{t(`${P}.role`)}</span>
              </span>
              <span className={styles.tag}>{t(`${P}.tag`)}</span>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
