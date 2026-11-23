'use client';

import { useRef, type CSSProperties } from 'react';
import Image from 'next/image';
import { Clock, MessageCircleQuestion, NotebookPen, type LucideIcon } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import ChatBubble from '../../ChatBubble';
import Container from '../../Container';
import RichText from '../../RichText';
import Section from '../../Section';
import SectionHead from '../../SectionHead';
import SiteLogo from '../../SiteLogo';
import { useSequenceReveal } from '../../useSequenceReveal';
import styles from './ProblemSection.module.css';

const P = 'site.home.problem';

/** Orden de entrada (--i): burbujas 0..3 y tarjetas intercaladas, como en el diseño */
const BUBBLES: Array<{ key: string; dir: 'in' | 'out'; time?: string; i: number }> = [
  { key: 'b1', dir: 'in', time: 't1', i: 0 },
  { key: 'b2', dir: 'out', time: 't2', i: 1 },
  { key: 'b3', dir: 'in', time: 't3', i: 2 },
  { key: 'b4', dir: 'out', i: 3 },
];

const CARDS: Array<{ n: 1 | 2 | 3; icon: LucideIcon; i: number }> = [
  { n: 1, icon: Clock, i: 1.5 },
  { n: 2, icon: MessageCircleQuestion, i: 2.5 },
  { n: 3, icon: NotebookPen, i: 3.5 },
];

/** Nombres de variable de la ficha: son identificadores, no se traducen */
const VARS = ['ocasion', 'producto_interes', 'etapa', 'puntaje'] as const;

const seq = (i: number) => ({ '--i': i }) as CSSProperties;

export default function ProblemSection() {
  const { t } = useTranslation();
  const proofRef = useRef<HTMLDivElement>(null);
  useSequenceReveal(proofRef);

  const r = (k: string) => t(`${P}.race.${k}`);
  const p = (k: string) => t(`${P}.proof.${k}`);

  return (
    <Section surface="dark" className={styles.problem}>
      <Container className={styles.content}>
        <SectionHead title={t(`${P}.title`)} lead={t(`${P}.lead`)} />

        {/* ---------- Carrera ---------- */}
        <div className={styles.race}>
          <div className={styles.raceMsg}>
            <span className={styles.raceMsgLabel}>
              <Image src="/site/img/logos/whatsapp.svg" alt="" width={24} height={24} unoptimized />
              {r('msgLabel')}
            </span>
            <ChatBubble direction="in" className={styles.raceBubble}>
              {r('msgText')}
            </ChatBubble>
          </div>

          <ul className={styles.rows} aria-label={r('rowsLabel')}>
            <li className={`${styles.row} ${styles.wait}`}>
              <div className={styles.who}>
                <b>{r('waitWho')}</b>
                <span>{r('waitDesc')}</span>
                <span className={styles.srOnly}>{r('waitRange')}</span>
              </div>
              <div className={styles.track} style={{ '--w': '100%' } as CSSProperties} aria-hidden="true">
                <i className={styles.dotA} />
                <i className={styles.dotB} />
                <em className={styles.ta}>{r('waitFrom')}</em>
                <em className={styles.tb}>{r('waitTo')}</em>
              </div>
              <p className={styles.big}>
                <strong>{r('waitBig')}</strong> <span>{r('unit')}</span>
              </p>
            </li>
            <li className={`${styles.row} ${styles.fast}`}>
              <div className={styles.who}>
                <b>{r('fastWho')}</b>
                <span>{r('fastDesc')}</span>
              </div>
              <div className={styles.track} style={{ '--w': '9%' } as CSSProperties} aria-hidden="true">
                <i className={styles.dotA} />
                <i className={styles.dotB} />
                <em className={styles.ta}>{r('fastFrom')}</em>
              </div>
              <p className={styles.big}>
                <strong>{r('fastBig')}</strong> <span>{r('unit')}</span>
              </p>
            </li>
          </ul>
        </div>

        {/* ---------- Prueba ---------- */}
        <div ref={proofRef} className={styles.proof}>
          <div className={styles.proofHead}>
            <h3 className={styles.proofTitle}>{p('title')}</h3>
            <p className={styles.proofLead}>{p('lead')}</p>
          </div>

          <div className={styles.proofGrid}>
            <div className={styles.phoneWrap}>
              <figure className={styles.phone} aria-label={p('phoneLabel')}>
                <div className={styles.screen}>
                  <div className={styles.phTop}>
                    <span className={styles.phAv} aria-hidden="true">
                      X
                    </span>
                    <div>
                      <b>{p('name')}</b>
                      <small>{p('status')}</small>
                    </div>
                  </div>
                  <div className={styles.phBody}>
                    {BUBBLES.map((b) => (
                      <div
                        key={b.key}
                        className={`${styles.seq} ${styles.b} ${b.dir === 'in' ? styles.bIn : styles.bOut}`}
                        style={seq(b.i)}
                      >
                        <RichText text={p(b.key)} />
                        {b.time ? <time>{p(b.time)}</time> : null}
                      </div>
                    ))}
                  </div>
                </div>
              </figure>
            </div>

            <div className={styles.cards}>
              <div className={styles.brand}>
                <SiteLogo to={null} className={styles.brandLogo} />
                <span>{p('brand')}</span>
              </div>
              {CARDS.map(({ n, icon: Icon, i }) => (
                <div key={n} className={`${styles.seq} ${styles.card}`} style={seq(i)}>
                  <span className={styles.ic} aria-hidden="true">
                    <Icon size={26} />
                  </span>
                  <div>
                    <h4 className={styles.cardTitle}>{p(`c${n}Title`)}</h4>
                    <p className={styles.cardText}>{p(`c${n}Text`)}</p>
                    {n === 3 ? (
                      <dl className={styles.vars} aria-label={p('varsLabel')}>
                        {VARS.map((v) => (
                          <div key={v} className={styles.var}>
                            <dt>{v}</dt>
                            <dd>{p(`vars.${v}`)}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
