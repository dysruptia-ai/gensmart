'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import Container from '../../Container';
import Section from '../../Section';
import SectionHead from '../../SectionHead';
import { cx } from '../ProductSubpage/cx';

const S = 'site.productAgents.steps';
const STEPS = [1, 2, 3, 4] as const;

/** "Un mensaje, cuatro pasos": lista ordenada y el registro del agente con el ejemplo. */
export default function AgentsSteps() {
  const { t } = useSiteTranslation();
  return (
    <Section surface="alt" rhythm="l">
      <Container>
        <SectionHead title={t(`${S}.title`)} lead={t(`${S}.lead`)} />
        <div className={cx('ag-trace')}>
          <ol className={cx('ag-steps')}>
            {STEPS.map((i) => (
              <li key={i} className={i === 4 ? cx('on') : undefined}>
                <span aria-hidden="true">{String(i).padStart(2, '0')}</span>
                <div>
                  <b>{t(`${S}.s${i}`)}</b>
                  <p>{t(`${S}.s${i}Desc`)}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className={cx('ag-log')} role="group" aria-label={t(`${S}.logLabel`)}>
            <div className={cx('ag-log-h')}>
              <span>{t(`${S}.log`)}</span>
            </div>
            <p className={cx('q')}>
              <small>{t(`${S}.logWho`)}</small>
              {t(`${S}.logQ`)}
            </p>
            {STEPS.map((i) => (
              <p key={i} className={i === 4 ? cx('go') : undefined}>
                <b>
                  {String(i).padStart(2, '0')} {t(`${S}.s${i}`)}
                </b>
                {t(`${S}.log${i}`)}
              </p>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
