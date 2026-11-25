'use client';

import { Bell } from 'lucide-react';
import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import Container from '../../Container';
import Section from '../../Section';
import SectionHead from '../../SectionHead';
import { cx } from '../ProductSubpage/cx';

const A = 'site.productCrm.auto';
const S = 'site.productShared';
const SCORE = 9;

/** "Tres cosas pasan sin que muevas un dedo": anota, puntúa y avisa, cada una con su maqueta. */
export default function CrmAuto() {
  const { t } = useSiteTranslation();
  const vars = [
    { label: t(`${S}.fields.name`), value: 'Valentina' },
    { label: t(`${S}.fields.email`), value: 'valentina@correo.com' },
    { label: t(`${S}.fields.downPayment`), value: t(`${S}.fields.downPaymentValue`) },
    { label: t(`${A}.visit`), value: t(`${A}.visitValue`) },
  ];
  return (
    <Section rhythm="l" className={cx('cx')}>
      <Container>
        <SectionHead title={t(`${A}.title`)} lead={t(`${A}.lead`)} />
        <div className={cx('cx-rows')}>
          <div className={cx('cx-row')}>
            <div className={cx('cx-t')}>
              <span className={cx('cx-num')} aria-hidden="true">
                01
              </span>
              <h3>{t(`${A}.r1`)}</h3>
              <p>{t(`${A}.r1Desc`)}</p>
            </div>
            <ul className={cx('cx-vars')} aria-label={t(`${A}.r1Label`)}>
              {vars.map((v) => (
                <li key={v.label}>
                  <small>{v.label}</small>
                  <b>{v.value}</b>
                  <u>{t(`${A}.noted`)}</u>
                </li>
              ))}
            </ul>
          </div>
          <div className={cx('cx-row')}>
            <div className={cx('cx-t')}>
              <span className={cx('cx-num')} aria-hidden="true">
                02
              </span>
              <h3>{t(`${A}.r2`)}</h3>
              <p>{t(`${A}.r2Desc`)}</p>
            </div>
            <div className={cx('cx-score')} role="group" aria-label={t(`${A}.r2Label`)}>
              <div className={cx('cx-big')}>
                <b>{SCORE}</b>
                <span>/10</span>
              </div>
              <div className={cx('cx-scale')} aria-hidden="true">
                {Array.from({ length: 10 }, (_, i) => (
                  <i key={i} className={i < SCORE ? cx('on') : undefined} />
                ))}
              </div>
              <dl>
                <dt>{t(`${A}.service`)}</dt>
                <dd>{t(`${S}.apt2`)}</dd>
                <dt>{t(`${A}.summary`)}</dt>
                <dd>{t(`${A}.summaryValue`)}</dd>
              </dl>
            </div>
          </div>
          <div className={cx('cx-row')}>
            <div className={cx('cx-t')}>
              <span className={cx('cx-num')} aria-hidden="true">
                03
              </span>
              <h3>{t(`${A}.r3`)}</h3>
              <p>{t(`${A}.r3Desc`)}</p>
            </div>
            <div className={cx('cx-note')} role="group" aria-label={t(`${A}.r3Label`)}>
              <div className={cx('cx-note-h')}>
                <span className={cx('cx-bell')} aria-hidden="true">
                  <Bell />
                </span>
                <b>{t(`${A}.alert`)}</b>
                <em>{t(`${A}.now`)}</em>
              </div>
              <p>{t(`${A}.alertText`)}</p>
              <div className={cx('cx-chips')}>
                <span>{t(`${A}.panel`)}</span>
                <span>{t(`${S}.fields.email`)}</span>
                <span>{t(`${A}.team`)}</span>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
