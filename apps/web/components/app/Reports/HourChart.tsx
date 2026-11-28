'use client';

import React, { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './HourChart.module.css';

export interface HourChartProps {
  byHour: number[];
  peak: { from: number; to: number; pct: number } | null;
}

const BW = 100 / 24;

/**
 * Barras por hora en SVG (como el diseño). Para lectores de pantalla: el SVG es una imagen con la franja
 * pico en su nombre y debajo va una tabla oculta con las 24 horas; el tooltip es solo para el mouse.
 */
export default function HourChart({ byHour, peak }: HourChartProps) {
  const { t } = useTranslation();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...byHour);
  const label = peak ? t('reports.hours.chartPeak', { from: peak.from, to: peak.to, pct: peak.pct }) : t('reports.hours.chart');
  return (
    <div className={styles.wrap}>
      <div className={styles.plot} onMouseLeave={() => setHover(null)}>
        <svg className={styles.chart} viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label={label}>
          {byHour.map((v, i) => {
            const h = (v / max) * 34;
            const hi = peak !== null && i >= peak.from && i < peak.to;
            return (
              <g key={i} onMouseEnter={() => setHover(i)}>
                {/* zona de hover a toda la altura, así las horas en 0 también muestran el tooltip */}
                <rect x={i * BW} y={0} width={BW} height={40} className={styles.hit} />
                <rect
                  x={(i * BW + 0.35).toFixed(2)}
                  y={(38 - h).toFixed(2)}
                  width={(BW - 0.7).toFixed(2)}
                  height={Math.max(h, v > 0 ? 0.6 : 0).toFixed(2)}
                  rx={0.6}
                  className={[styles.bar, hi && styles.hi, hover === i && styles.active].filter(Boolean).join(' ')}
                />
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <div
            className={styles.tooltip}
            style={{ left: `${(hover + 0.5) * BW}%` }}
            data-edge={hover < 3 ? 'start' : hover > 20 ? 'end' : undefined}
            aria-hidden="true"
          >
            {t('reports.hours.tooltip', { from: hover, to: hover + 1, count: byHour[hover] ?? 0 })}
          </div>
        )}
      </div>
      <div className={styles.axis} aria-hidden="true">
        <span>0h</span>
        <span>6h</span>
        <span>12h</span>
        <span>18h</span>
        <span>24h</span>
      </div>
      <div className="gsSr">
      <table>
        <caption>{t('reports.hours.title')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('reports.hours.hour')}</th>
            <th scope="col">{t('reports.hours.conversations')}</th>
          </tr>
        </thead>
        <tbody>
          {byHour.map((v, i) => (
            <tr key={i}>
              <th scope="row">{t('reports.hours.hourRange', { from: i, to: i + 1 })}</th>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
