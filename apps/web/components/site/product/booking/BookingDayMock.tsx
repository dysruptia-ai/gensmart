'use client';

import { useTranslation } from '@/hooks/useTranslation';
import MockChat, { type MockMessage } from '../ProductSubpage/MockChat';
import MockWindow from '../ProductSubpage/MockWindow';
import { cx } from '../ProductSubpage/cx';

const H = 'site.productBooking.hero';

type SlotState = 'done' | 'gone' | 'free' | 'new';

const DAY: ReadonlyArray<{ time: string; who?: string; state: SlotState }> = [
  { time: '9:00', who: 'Camilo R.', state: 'done' },
  { time: '9:40', who: 'Andrés P.', state: 'gone' },
  { time: '10:20', state: 'free' },
  { time: '11:00', who: 'Valentina', state: 'new' },
  { time: '11:40', state: 'free' },
];

/** Estado de la cita → píldora del diseño (`.st.p`, `.st.c`, `.st.a`) y su texto. */
const PILL: Record<Exclude<SlotState, 'free'>, { cls: string; key: string }> = {
  done: { cls: 'p', key: 'completed' },
  gone: { cls: 'c', key: 'cancelled' },
  new: { cls: 'a', key: 'scheduled' },
};

/** Hero de la agenda: la reserva de Valentina y el sábado con sus estados. */
export default function BookingDayMock() {
  const { t } = useTranslation();
  const messages: MockMessage[] = [1, 2, 3, 4].map((i) => ({
    dir: i % 2 === 1 ? 'in' : 'out',
    text: t(`${H}.m${i}`),
  }));
  return (
    <MockWindow label={t(`${H}.mockLabel`)} bar={t(`${H}.bar`)} variant={['crm-ex']}>
      <div className={cx('ex-body')}>
        <div className={cx('ex-chat')}>
          <div className={cx('ex-h')}>
            <b>Valentina</b>
            <span>WhatsApp</span>
          </div>
          <MockChat messages={messages} />
        </div>
        <div className={cx('ex-rec', 'dy-rec')}>
          <div className={cx('ex-h')}>
            <b>{t(`${H}.day`)}</b>
            <span className={cx('ex-new')}>{t(`${H}.service`)}</span>
          </div>
          <ol className={cx('dy-day')}>
            {DAY.map((slot) => (
              <li key={slot.time} className={cx(slot.state)}>
                <time>{slot.time}</time>
                {slot.state === 'free' ? (
                  <span>{t(`${H}.free`)}</span>
                ) : (
                  <>
                    <b>{slot.who}</b>
                    <em className={cx('st', PILL[slot.state].cls)}>{t(`${H}.${PILL[slot.state].key}`)}</em>
                  </>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </MockWindow>
  );
}
