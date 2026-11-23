'use client';

import { useTranslation } from '@/hooks/useTranslation';
import MockChat from '../ProductSubpage/MockChat';
import MockWindow from '../ProductSubpage/MockWindow';
import { cx } from '../ProductSubpage/cx';
import { valentinaThread } from '../ProductSubpage/valentina';
import MarkedText from './MarkedText';

const H = 'site.productCrm.hero';
const S = 'site.productShared';

/** Hero del CRM: la conversación numerada y la ficha donde cae cada dato. */
export default function CrmRecordMock() {
  const { t } = useTranslation();
  const fields = [
    { n: 1, label: t(`${H}.interest`), value: t(`${S}.apt2`), tag: 'scored' },
    { n: 2, label: t(`${S}.fields.downPayment`), value: t(`${S}.fields.downPaymentValue`), tag: 'noted' },
    { n: 3, label: t(`${S}.fields.email`), value: 'valentina@correo.com', tag: 'noted' },
  ] as const;
  return (
    <MockWindow label={t(`${H}.mockLabel`)} bar={t(`${H}.bar`)} variant={['crm-ex']}>
      <div className={cx('ex-body')}>
        <div className={cx('ex-chat')}>
          <div className={cx('ex-h')}>
            <b>Valentina</b>
            <span>Instagram</span>
          </div>
          <MockChat
            messages={valentinaThread(t, {
              1: <MarkedText text={t(`${H}.m1`)} />,
              3: <MarkedText text={t(`${H}.m3`)} />,
            })}
          />
        </div>
        <div className={cx('ex-rec')}>
          <div className={cx('ex-h')}>
            <b>{t(`${H}.record`)}</b>
            <span className={cx('ex-new')}>{t(`${H}.created`)}</span>
          </div>
          <ol className={cx('ex-f')}>
            {fields.map((f) => (
              <li key={f.n}>
                <span className={cx('ex-n')} aria-hidden="true">
                  {f.n}
                </span>
                <div>
                  <small>{f.label}</small>
                  <b>{f.value}</b>
                </div>
                <i className={cx('ex-tag', f.tag === 'scored' ? 'ai' : 'ag')}>
                  {t(f.tag === 'scored' ? `${H}.tagScored` : `${H}.tagNoted`)}
                </i>
              </li>
            ))}
          </ol>
          <div className={cx('ex-score')}>
            <div>
              <small>{t(`${S}.fields.score`)}</small>
              <b>
                6<em>/10</em>
              </b>
            </div>
            <div>
              <small>{t(`${H}.funnelStage`)}</small>
              <span className={cx('st', 'a')}>{t(`${S}.stage.opportunity`)}</span>
            </div>
            <i className={cx('ex-tag', 'ai')}>{t(`${H}.tagScored`)}</i>
          </div>
          <div className={cx('ex-sum')}>
            <small>{t(`${H}.summaryLabel`)}</small>
            <p>{t(`${H}.summary`)}</p>
          </div>
        </div>
      </div>
    </MockWindow>
  );
}
