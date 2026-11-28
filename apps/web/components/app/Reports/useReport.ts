'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { InboxReport, ReportPeriodKey } from './types';

export interface ReportState {
  /** El último informe cargado (se mantiene mientras carga otro período, para que la pantalla no salte). */
  data: InboxReport | null;
  loading: boolean;
  error: boolean;
  reload: () => void;
}

interface Settled {
  key: string;
  data: InboxReport | null;
  error: boolean;
}

export function useReport(period: ReportPeriodKey): ReportState {
  const [attempt, setAttempt] = useState(0);
  const key = `${period}:${attempt}`;
  const [settled, setSettled] = useState<Settled>({ key: '', data: null, error: false });

  useEffect(() => {
    let alive = true;
    api
      .get<InboxReport>(`/api/reports/inbox?period=${period}`)
      .then((data) => alive && setSettled({ key, data, error: false }))
      .catch(() => alive && setSettled((s) => ({ key, data: s.data, error: true })));
    return () => {
      alive = false;
    };
  }, [period, key]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const loading = settled.key !== key;
  return { data: settled.data, loading, error: !loading && settled.error, reload };
}
