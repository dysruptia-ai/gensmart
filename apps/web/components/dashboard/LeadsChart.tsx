'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import { BarChart3 } from 'lucide-react';
import styles from './LeadsChart.module.css';

type Period = '7d' | '30d' | '90d';

interface DataPoint {
  date: string;
  count: number;
}

interface ChartResponse {
  period: Period;
  data: DataPoint[];
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  date: string;
  count: number;
}

function formatLabel(dateStr: string, period: Period): string {
  const d = new Date(dateStr + 'T00:00:00');
  if (period === '90d') {
    return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
  }
  return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
}

function formatTooltipDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function LeadsChart() {
  const [period, setPeriod] = useState<Period>('7d');
  const [data, setData] = useState<DataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, date: '', count: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    setIsLoading(true);
    api
      .get<ChartResponse>(`/api/dashboard/leads-chart?period=${period}`)
      .then((res) => setData(res.data))
      .catch(() => setData([]))
      .finally(() => setIsLoading(false));

  }, [period]);

  const hasData = data.some((d) => d.count > 0);
  const PADDING = { top: 24, right: 16, bottom: 36, left: 36 };
  const WIDTH = 600;
  const HEIGHT = 200;
  const chartW = WIDTH - PADDING.left - PADDING.right;
  const chartH = HEIGHT - PADDING.top - PADDING.bottom;

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const step = chartW / Math.max(data.length - 1, 1);

  const points = data.map((d, i) => ({
    x: PADDING.left + i * step,
    y: PADDING.top + chartH - (d.count / maxCount) * chartH,
    date: d.date,
    count: d.count,
  }));

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
  const polygonPoints = points.length > 0
    ? `${points[0]!.x},${PADDING.top + chartH} ${polylinePoints} ${points[points.length - 1]!.x},${PADDING.top + chartH}`
    : '';

  // X-axis labels: show every Nth to avoid crowding
  const labelStep = data.length <= 7 ? 1 : data.length <= 14 ? 2 : data.length <= 30 ? 5 : 7;
  const xLabels = points.filter((_, i) => i % labelStep === 0 || i === points.length - 1);

  // Y-axis ticks (3 ticks)
  const yTicks = [0, Math.ceil(maxCount / 2), maxCount];

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const mx = (e.clientX - rect.left) * scaleX;

    let closest = points[0]!;
    let minDist = Math.abs(mx - closest.x);
    for (const p of points) {
      const dist = Math.abs(mx - p.x);
      if (dist < minDist) { minDist = dist; closest = p; }
    }

    const scaleY = HEIGHT / rect.height;
    setTooltip({
      visible: true,
      x: closest.x,
      y: closest.y,
      date: closest.date,
      count: closest.count,
    });
    void scaleY;
  }

  function handleMouseLeave() {
    setTooltip((t) => ({ ...t, visible: false }));
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>New Leads</h2>
        <div className={styles.periods}>
          {(['7d', '30d', '90d'] as Period[]).map((p) => (
            <button
              key={p}
              className={`${styles.periodBtn} ${period === p ? styles.periodBtnActive : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.chartWrap}>
        {isLoading ? (
          <Skeleton width="100%" height={200} />
        ) : !hasData ? (
          <EmptyState icon={BarChart3} title="No data yet" description="Leads will appear here as they come in." />
        ) : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className={styles.svg}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            aria-label="Leads over time chart"
          >
            {/* Grid lines */}
            {yTicks.map((tick, i) => {
              const ty = PADDING.top + chartH - (tick / maxCount) * chartH;
              return (
                <g key={i}>
                  <line
                    x1={PADDING.left}
                    y1={ty}
                    x2={PADDING.left + chartW}
                    y2={ty}
                    stroke="var(--color-border)"
                    strokeWidth="1"
                  />
                  <text
                    x={PADDING.left - 6}
                    y={ty + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="var(--color-text-secondary)"
                  >
                    {tick}
                  </text>
                </g>
              );
            })}

            {/* Area fill */}
            {polygonPoints && (
              <polygon
                points={polygonPoints}
                fill="var(--color-primary-light)"
                opacity="0.6"
              />
            )}

            {/* Line */}
            {polylinePoints && (
              <polyline
                points={polylinePoints}
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {/* Data point circles */}
            {points.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={tooltip.visible && tooltip.date === p.date ? 5 : 3}
                fill={tooltip.visible && tooltip.date === p.date ? 'var(--color-primary-dark)' : 'var(--color-primary)'}
                stroke="white"
                strokeWidth="1.5"
              />
            ))}

            {/* X-axis labels */}
            {xLabels.map((p, i) => (
              <text
                key={i}
                x={p.x}
                y={HEIGHT - 6}
                textAnchor="middle"
                fontSize="10"
                fill="var(--color-text-secondary)"
              >
                {formatLabel(p.date, period)}
              </text>
            ))}

            {/* Tooltip */}
            {tooltip.visible && (() => {
              const tx = tooltip.x;
              const ty = tooltip.y - 12;
              const label = `${formatTooltipDate(tooltip.date)}: ${tooltip.count}`;
              const boxW = Math.max(label.length * 5.5 + 12, 80);
              const boxX = Math.min(tx - boxW / 2, WIDTH - boxW - 4);
              const boxY = Math.max(ty - 28, 2);
              return (
                <g>
                  <rect
                    x={boxX}
                    y={boxY}
                    width={boxW}
                    height={22}
                    rx={4}
                    fill="var(--color-text-primary)"
                    opacity="0.85"
                  />
                  <text
                    x={boxX + boxW / 2}
                    y={boxY + 15}
                    textAnchor="middle"
                    fontSize="10"
                    fill="white"
                    fontWeight="600"
                  >
                    {label}
                  </text>
                </g>
              );
            })()}
          </svg>
        )}
      </div>
    </div>
  );
}
