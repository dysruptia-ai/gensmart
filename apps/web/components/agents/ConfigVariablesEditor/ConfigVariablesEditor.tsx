'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import Spinner from '@/components/ui/Spinner';
import { api, ApiError } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/components/ui/Toast';
import ConfigVariableField from './ConfigVariableField';
import ConfigVariableOverridesEditor from './ConfigVariableOverridesEditor';
import {
  type ConfigVariableSchema,
  type ConfigVariableValue,
  type ConfigVariableValues,
} from './types';
import styles from './ConfigVariablesEditor.module.css';

interface Props {
  agentId: string;
  templateName?: string | null;
  onMissingCountChange?: (count: number) => void;
}

export default function ConfigVariablesEditor({
  agentId,
  templateName,
  onMissingCountChange,
}: Props) {
  const { t, language } = useTranslation();
  const { error: toastError } = useToast();

  const [loading, setLoading] = useState(true);
  const [schema, setSchema] = useState<ConfigVariableSchema[]>([]);
  const [values, setValues] = useState<ConfigVariableValues>({});
  const [overrides, setOverrides] = useState<ConfigVariableSchema[]>([]);
  const [templateKeys, setTemplateKeys] = useState<string[]>([]);
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [savingOverrides, setSavingOverrides] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const reportMissing = useCallback(
    (s: ConfigVariableSchema[], v: ConfigVariableValues) => {
      if (!onMissingCountChange) return;
      const n = s.filter(
        (entry) =>
          entry.required &&
          (v[entry.key] === undefined || v[entry.key] === null || v[entry.key] === ''),
      ).length;
      onMissingCountChange(n);
    },
    [onMissingCountChange],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{
        schema: ConfigVariableSchema[];
        values: ConfigVariableValues;
        templateId: string | null;
      }>(`/api/agents/${agentId}/config-schema`);
      // To compute templateKeys (= keys defined only by the template), we need
      // to know which keys came from the override array. The agent endpoint
      // gives us the merged schema, but we also fetch the agent row to read
      // the raw overrides list.
      const agentResp = await api.get<{
        agent: { configVariablesSchemaOverrides?: ConfigVariableSchema[] };
      }>(`/api/agents/${agentId}`);
      const rawOverrides = Array.isArray(agentResp.agent.configVariablesSchemaOverrides)
        ? agentResp.agent.configVariablesSchemaOverrides
        : [];
      setOverrides(rawOverrides);
      const overrideKeys = new Set(rawOverrides.map((o) => o.key));
      setTemplateKeys(data.schema.filter((s) => !overrideKeys.has(s.key)).map((s) => s.key));
      setSchema(data.schema);
      setValues(data.values);
      reportMissing(data.schema, data.values);
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, [agentId, reportMissing, toastError]);

  useEffect(() => {
    load();
  }, [load]);

  const handleChange = (key: string, value: ConfigVariableValue) => {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      reportMissing(schema, next);
      return next;
    });
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleCommit = async (key: string, value: ConfigVariableValue) => {
    // Avoid round-trip when value unchanged (compare loose for null/undefined)
    const prev = values[key];
    const noChange =
      prev === value || (prev === null && value === '') || (prev === undefined && value === '');
    if (noChange) return;
    setSavingKeys((s) => new Set(s).add(key));
    try {
      const resp = await api.patch<{ values: ConfigVariableValues }>(
        `/api/agents/${agentId}/config-values`,
        { values: { [key]: value } },
      );
      setValues(resp.values);
      reportMissing(schema, resp.values);
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch (err) {
      if (err instanceof ApiError && err.details && err.details['errors']) {
        const e = err.details['errors'] as Record<string, string>;
        setErrors((prev) => ({ ...prev, ...e }));
      } else {
        toastError(err instanceof ApiError ? err.message : 'Save failed');
      }
    } finally {
      setSavingKeys((s) => {
        const next = new Set(s);
        next.delete(key);
        return next;
      });
    }
  };

  const handleSaveOverrides = async (next: ConfigVariableSchema[]) => {
    setSavingOverrides(true);
    try {
      const resp = await api.put<{
        overrides: ConfigVariableSchema[];
        schema: ConfigVariableSchema[];
      }>(`/api/agents/${agentId}/config-overrides`, { overrides: next });
      setOverrides(resp.overrides);
      setSchema(resp.schema);
      const overrideKeys = new Set(resp.overrides.map((o) => o.key));
      setTemplateKeys(resp.schema.filter((s) => !overrideKeys.has(s.key)).map((s) => s.key));
      reportMissing(resp.schema, values);
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Failed to save overrides');
    } finally {
      setSavingOverrides(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingRow}>
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('agents.configVariables.title')}</h2>
        <p className={styles.description}>{t('agents.configVariables.description')}</p>
        {templateName && (
          <p className={styles.poweredBy}>
            {t('agents.configVariables.poweredByTemplate', { name: templateName })}
          </p>
        )}
      </div>

      {schema.length === 0 ? (
        <div className={styles.emptyState}>{t('agents.configVariables.emptyState')}</div>
      ) : (
        <div className={styles.fields}>
          {schema.map((variable) => (
            <ConfigVariableField
              key={variable.key}
              variable={variable}
              value={values[variable.key] ?? null}
              error={errors[variable.key] ? t(errors[variable.key]!) : null}
              language={language}
              saving={savingKeys.has(variable.key)}
              onChange={handleChange}
              onCommit={handleCommit}
            />
          ))}
        </div>
      )}

      <div className={styles.section}>
        <button
          type="button"
          className={styles.sectionToggle}
          onClick={() => setAdvancedOpen((v) => !v)}
          aria-expanded={advancedOpen}
        >
          {advancedOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          {t('agents.configVariables.advancedSection')}
        </button>
        {advancedOpen && (
          <>
            <p className={styles.sectionDescription}>
              {t('agents.configVariables.advancedDescription')}
            </p>
            <ConfigVariableOverridesEditor
              overrides={overrides}
              templateKeys={templateKeys}
              saving={savingOverrides}
              onSave={handleSaveOverrides}
            />
          </>
        )}
      </div>
    </div>
  );
}
