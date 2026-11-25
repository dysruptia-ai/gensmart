'use client';

import type { ReactNode } from 'react';
import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import Container from '../../Container';
import Section from '../../Section';
import SectionHead from '../../SectionHead';
import { cx } from '../ProductSubpage/cx';
import CalendarRulesMock from './CalendarRulesMock';
import MonthMock from './MonthMock';
import OfferMock from './OfferMock';
import SlotsMock from './SlotsMock';

const P = 'site.productBooking.steps';

/** "Una cita, cuatro pasos": lista ordenada, cada paso con su maqueta. */
export default function BookingSteps() {
  const { t } = useSiteTranslation();
  const steps: ReadonlyArray<{ n: number; visual: ReactNode }> = [
    { n: 1, visual: <div className={cx('dy-vis')}><CalendarRulesMock /></div> },
    { n: 2, visual: <SlotsMock /> },
    { n: 3, visual: <OfferMock /> },
    // El aviso de este paso es para el equipo (panel): no hay recordatorio al cliente
    { n: 4, visual: <div className={cx('dy-vis')}><MonthMock /></div> },
  ];
  return (
    <Section rhythm="l">
      <Container>
        <SectionHead title={t(`${P}.title`)} lead={t(`${P}.lead`)} />
        <ol className={cx('dy-steps')}>
          {steps.map((s) => (
            <li key={s.n} className={cx('dy-step')}>
              <span className={cx('dy-n')} aria-hidden="true">
                {s.n}
              </span>
              <div className={cx('dy-tx2')}>
                <h3>{t(`${P}.s${s.n}`)}</h3>
                <p>{t(`${P}.s${s.n}Desc`)}</p>
              </div>
              {s.visual}
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
