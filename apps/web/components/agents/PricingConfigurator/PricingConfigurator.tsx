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
  costoEnvioEstimado: number;
  gananciaNeta: number | null;
  gananciaMinima: number;
  precioVentaMinimoRecomendado: number | null;
  cumpleMinimo: boolean | null;
}

function rowKey(row: { idProduct: string; idVariant: string | null }): string {
  return `${row.idProduct}::${row.idVariant ?? ''}`;
}

function gananciaNetaFor(basePrice: number | null, salePrice: number | null, costoEnvio: number): number | null {
  if (basePrice === null || salePrice === null) return null;
  return salePrice - basePrice - costoEnvio;
}

function formatCOP(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

interface PricingConfiguratorProps {
  agentId: string;
}

export default function PricingConfigurator({ agentId }: PricingConfiguratorProps) {
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
              <th className={styles.th}>{t('agents.pricing.columns.netProfit')}</th>
              <th className={styles.th}>{t('agents.pricing.columns.minSuggestedPrice')}</th>
              <th className={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const key = rowKey(row);
              const currentSalePrice = edited[key] ?? row.salePrice ?? 0;
              const gananciaNeta = gananciaNetaFor(row.basePrice, currentSalePrice, row.costoEnvioEstimado);
              const semaphore =
                gananciaNeta === null
                  ? 'neutral'
                  : gananciaNeta < 0
                    ? 'red'
                    : gananciaNeta < row.gananciaMinima
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
                    {gananciaNeta !== null ? (
                      <span className={`${styles.marginBadge} ${styles[semaphore]}`}>
                        <CircleDot size={10} />
                        {formatCOP(gananciaNeta)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={styles.td}>
                    {row.precioVentaMinimoRecomendado !== null ? formatCOP(row.precioVentaMinimoRecomendado) : '—'}
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
