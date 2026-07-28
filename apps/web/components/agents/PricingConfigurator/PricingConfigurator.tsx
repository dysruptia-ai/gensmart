'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { TrendingUp, AlertTriangle, CircleDot, Save } from 'lucide-react';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import { api, ApiError } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './PricingConfigurator.module.css';

interface CatalogPriceRow {
  idProduct: string;
  idVariant: string | null;
  nombre: string;
  basePrice: number | null;
  suggestedPrice: number | null;
  salePrice: number | null;
  tieneOverride: boolean;
}

const DEFAULT_MIN_MARGIN_PCT = 20;

function rowKey(row: { idProduct: string; idVariant: string | null }): string {
  return `${row.idProduct}::${row.idVariant ?? ''}`;
}

function marginPct(basePrice: number | null, salePrice: number | null): number | null {
  if (basePrice === null || salePrice === null || basePrice <= 0) return null;
  return ((salePrice - basePrice) / basePrice) * 100;
}

interface PricingConfiguratorProps {
  agentId: string;
  /** Minimum margin % for the green/yellow threshold. Falls back to 20 until
   *  the `margen_minimo_pct` config variable ships (Prompt 3). */
  minMarginPct?: number;
}

export default function PricingConfigurator({
  agentId,
  minMarginPct = DEFAULT_MIN_MARGIN_PCT,
}: PricingConfiguratorProps) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<CatalogPriceRow[]>([]);
  const [edited, setEdited] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notConnected, setNotConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotConnected(false);
    try {
      const data = await api.get<{ prices: CatalogPriceRow[] }>(`/api/agents/${agentId}/pricing`);
      setRows(data.prices);
      setEdited({});
    } catch (err) {
      if (err instanceof ApiError && err.code === 'MASTERSHOP_NOT_CONNECTED') {
        setNotConnected(true);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    load();
  }, [load]);

  function handlePriceChange(row: CatalogPriceRow, value: string) {
    const num = Number(value);
    setEdited((prev) => ({ ...prev, [rowKey(row)]: Number.isFinite(num) ? num : 0 }));
  }

  async function handleSave() {
    const changed = rows
      .filter((r) => rowKey(r) in edited)
      .map((r) => ({ idProduct: r.idProduct, idVariant: r.idVariant, salePrice: edited[rowKey(r)]! }));
    if (changed.length === 0) return;

    setSaving(true);
    setError(null);
    try {
      await api.put(`/api/agents/${agentId}/pricing`, { prices: changed });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <Spinner />
      </div>
    );
  }

  if (notConnected) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title={t('agents.pricing.noMastershop')}
        description={t('agents.pricing.noMastershopHint')}
      />
    );
  }

  const hasChanges = Object.keys(edited).length > 0;

  return (
    <div className={styles.root}>
      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.toolbar}>
        <div className={styles.toolbarTitle}>
          <TrendingUp size={16} />
          {t('agents.pricing.title')}
        </div>
        <Button size="sm" icon={Save} onClick={handleSave} loading={saving} disabled={!hasChanges}>
          {t('agents.pricing.save')}
        </Button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>{t('agents.pricing.columns.product')}</th>
              <th className={styles.th}>{t('agents.pricing.columns.basePrice')}</th>
              <th className={styles.th}>{t('agents.pricing.columns.salePrice')}</th>
              <th className={styles.th}>{t('agents.pricing.columns.margin')}</th>
              <th className={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const key = rowKey(row);
              const currentSalePrice = edited[key] ?? row.salePrice ?? 0;
              const margin = marginPct(row.basePrice, currentSalePrice);
              const semaphore =
                margin === null
                  ? 'neutral'
                  : margin < 0
                    ? 'red'
                    : margin < minMarginPct
                      ? 'yellow'
                      : 'green';

              return (
                <tr key={key} className={styles.row}>
                  <td className={styles.td}>
                    {row.nombre}
                    {row.idVariant && <span className={styles.variantTag}>{row.idVariant}</span>}
                  </td>
                  <td className={styles.td}>
                    {row.basePrice !== null ? `$${row.basePrice.toLocaleString()}` : '—'}
                  </td>
                  <td className={styles.td}>
                    <input
                      type="number"
                      className={styles.priceInput}
                      value={currentSalePrice}
                      onChange={(e) => handlePriceChange(row, e.target.value)}
                      min={0}
                    />
                  </td>
                  <td className={styles.td}>
                    {margin !== null ? (
                      <span className={`${styles.marginBadge} ${styles[semaphore]}`}>
                        <CircleDot size={10} />
                        {margin.toFixed(1)}%
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={styles.td}>
                    {row.tieneOverride && (
                      <span className={styles.overrideTag}>{t('agents.pricing.override')}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
