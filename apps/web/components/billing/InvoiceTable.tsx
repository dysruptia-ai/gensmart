'use client';

import React from 'react';
import { Download, FileText } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import styles from './InvoiceTable.module.css';

interface Invoice {
  id: string;
  number: string | null;
  amount: number;
  currency: string;
  status: string | null;
  created: number;
  pdfUrl: string | null;
  hostedUrl: string | null;
}

interface Props {
  invoices: Invoice[];
  loading: boolean;
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getStatusVariant(status: string | null): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'paid': return 'success';
    case 'open': return 'warning';
    case 'void':
    case 'uncollectible': return 'danger';
    default: return 'neutral';
  }
}

export default function InvoiceTable({ invoices, loading }: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.title}>Invoice History</div>

      {loading ? (
        <div className={styles.empty}>Loading invoices...</div>
      ) : invoices.length === 0 ? (
        <div className={styles.empty}>
          <FileText size={24} style={{ display: 'block', margin: '0 auto 0.5rem', opacity: 0.4 }} />
          No invoices yet. They will appear here after your first payment.
        </div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Invoice</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Download</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td>{formatDate(inv.created)}</td>
                <td style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-xs)' }}>
                  {inv.number ?? '—'}
                </td>
                <td>{formatAmount(inv.amount, inv.currency)}</td>
                <td>
                  <Badge variant={getStatusVariant(inv.status)}>
                    {inv.status ?? 'unknown'}
                  </Badge>
                </td>
                <td>
                  {inv.pdfUrl ? (
                    <a
                      href={inv.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.downloadLink}
                    >
                      <Download size={12} />
                      PDF
                    </a>
                  ) : inv.hostedUrl ? (
                    <a
                      href={inv.hostedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.downloadLink}
                    >
                      View
                    </a>
                  ) : (
                    <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-xs)' }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
