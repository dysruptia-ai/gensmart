'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import Container from '../../Container';
import Section from '../../Section';
import SectionHead from '../../SectionHead';
import { cx } from '../ProductSubpage/cx';
import { byoKeyPlanName } from '../ProductSubpage/subpageData';

const T = 'site.productAgents.teach';

const FILES: ReadonlyArray<{ kind: string; key: string }> = [
  { kind: 'PDF', key: 'prices' },
  { kind: 'PDF', key: 'policy' },
  { kind: 'PDF', key: 'catalog' },
  { kind: 'URL', key: 'faq' },
];

/** Nombres de función del ejemplo: código, no se traducen (como en el diseño). */
const FUNCTIONS: ReadonlyArray<string> = [
  'consultar_inventario(sku)',
  'crear_pedido(cliente, items)',
  'agendar_cita(fecha, hora)',
];

/** "Lo que le enseñas": base de conocimiento, funciones personalizadas y servidores MCP. */
export default function AgentsTeach() {
  const { t } = useSiteTranslation();
  const plan = byoKeyPlanName();
  return (
    <Section rhythm="l">
      <Container>
        <SectionHead title={t(`${T}.title`)} lead={t(`${T}.lead`)} />
        <div className={cx('ag-rows')}>
          <article className={cx('ag-row')}>
            <div className={cx('ag-row-t')}>
              <span className={cx('ag-num')} aria-hidden="true">
                01
              </span>
              <h3>{t(`${T}.kbTitle`)}</h3>
              <p>{t(`${T}.kbDesc`)}</p>
            </div>
            <div className={cx('ag-row-v')}>
              <ul className={cx('ag-files')} aria-label={t(`${T}.kbLabel`)}>
                {FILES.map((f) => (
                  <li key={f.key}>
                    <i>{f.kind}</i>
                    {t(`${T}.files.${f.key}`)}
                    <u>{t(`${T}.ready`)}</u>
                  </li>
                ))}
              </ul>
            </div>
          </article>
          <article className={cx('ag-row')}>
            <div className={cx('ag-row-t')}>
              <span className={cx('ag-num')} aria-hidden="true">
                02
              </span>
              <h3>{t(`${T}.fnTitle`)}</h3>
              <p>{t(`${T}.fnDesc`)}</p>
            </div>
            <div className={cx('ag-row-v')} role="group" aria-label={t(`${T}.fnLabel`)}>
              <pre className={cx('ag-code')}>
                <code>
                  {FUNCTIONS.map((fn, i) => (
                    <span key={fn}>
                      <s>fn</s> {fn}
                      {i < FUNCTIONS.length - 1 ? '\n' : null}
                    </span>
                  ))}
                </code>
              </pre>
            </div>
          </article>
          <article className={cx('ag-row')}>
            <div className={cx('ag-row-t')}>
              <span className={cx('ag-num')} aria-hidden="true">
                03
              </span>
              <h3>{t(`${T}.mcpTitle`)}</h3>
              <p>{t(`${T}.mcpDesc`)}</p>
            </div>
            <div className={cx('ag-row-v')}>
              <div className={cx('ag-mcp')} role="img" aria-label={t(`${T}.mcpLabel`)}>
                <span>{t(`${T}.mcpAgent`)}</span>
                <i />
                <span className={cx('mid')}>MCP</span>
                <i />
                <span>{t(`${T}.mcpTool`)}</span>
              </div>
            </div>
          </article>
        </div>
        {plan ? <p className={cx('src')}>{t(`${T}.byo`, { plan })}</p> : null}
      </Container>
    </Section>
  );
}
