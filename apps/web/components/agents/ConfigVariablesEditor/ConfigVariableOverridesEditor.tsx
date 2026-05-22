'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Toggle from '@/components/ui/Toggle';
import { useTranslation } from '@/hooks/useTranslation';
import {
  isValidKey,
  type ConfigVariableOption,
  type ConfigVariableSchema,
  type ConfigVariableType,
} from './types';
import styles from './ConfigVariablesEditor.module.css';

interface Props {
  overrides: ConfigVariableSchema[];
  templateKeys: string[];
  saving: boolean;
  onSave: (overrides: ConfigVariableSchema[]) => Promise<void>;
}

const TYPES: ConfigVariableType[] = ['string', 'textarea', 'number', 'boolean', 'url', 'enum'];

const blankEntry = (): ConfigVariableSchema => ({
  key: '',
  type: 'string',
  label_en: '',
  label_es: '',
  required: false,
});

export default function ConfigVariableOverridesEditor({
  overrides,
  templateKeys,
  saving,
  onSave,
}: Props) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<{ index: number | null; entry: ConfigVariableSchema } | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);

  const templateKeySet = useMemo(() => new Set(templateKeys), [templateKeys]);

  // Reset key error when modal opens/closes
  useEffect(() => {
    if (!editing) setKeyError(null);
  }, [editing]);

  const openCreate = () => setEditing({ index: null, entry: blankEntry() });
  const openEdit = (idx: number) => setEditing({ index: idx, entry: { ...overrides[idx]! } });

  const handleDelete = async (idx: number) => {
    const next = overrides.filter((_, i) => i !== idx);
    await onSave(next);
  };

  const handleSaveModal = async () => {
    if (!editing) return;
    const e = editing.entry;
    if (!isValidKey(e.key)) {
      setKeyError(t('agents.configVariables.errors.invalidKey'));
      return;
    }
    const duplicate = overrides.some((o, i) => o.key === e.key && i !== editing.index);
    if (duplicate) {
      setKeyError(t('agents.configVariables.errors.duplicateKey'));
      return;
    }
    if (!e.label_en.trim() || !e.label_es.trim()) {
      setKeyError(t('agents.configVariables.errors.invalidLabel'));
      return;
    }
    if (e.type === 'enum' && (!e.options || e.options.length === 0)) {
      setKeyError(t('agents.configVariables.errors.noOptions'));
      return;
    }
    const cleaned: ConfigVariableSchema = {
      ...e,
      key: e.key.trim(),
      label_en: e.label_en.trim(),
      label_es: e.label_es.trim(),
    };
    const next =
      editing.index === null
        ? [...overrides, cleaned]
        : overrides.map((o, i) => (i === editing.index ? cleaned : o));
    await onSave(next);
    setEditing(null);
  };

  const updateEntry = (patch: Partial<ConfigVariableSchema>) => {
    if (!editing) return;
    setEditing({ index: editing.index, entry: { ...editing.entry, ...patch } });
  };

  const updateOption = (idx: number, patch: Partial<ConfigVariableOption>) => {
    if (!editing) return;
    const opts = [...(editing.entry.options ?? [])];
    opts[idx] = { ...opts[idx]!, ...patch };
    updateEntry({ options: opts });
  };

  const addOption = () => {
    const opts = [...(editing?.entry.options ?? []), { value: '', label_en: '', label_es: '' }];
    updateEntry({ options: opts });
  };

  const removeOption = (idx: number) => {
    const opts = (editing?.entry.options ?? []).filter((_, i) => i !== idx);
    updateEntry({ options: opts });
  };

  return (
    <div className={styles.sectionBody}>
      {overrides.length === 0 && (
        <div className={styles.emptyState}>
          {t('agents.configVariables.advancedDescription')}
        </div>
      )}
      {overrides.map((o, i) => {
        const overrides_template = templateKeySet.has(o.key);
        return (
          <div key={`${o.key}-${i}`} className={styles.overrideRow}>
            <div className={styles.overrideMeta}>
              <span className={styles.overrideName}>{o.label_en}</span>
              <span className={styles.overrideType}>
                {o.key} · {o.type}
                {o.required ? ' · required' : ''}
                {overrides_template ? ' · overrides template' : ''}
              </span>
            </div>
            <div className={styles.overrideActions}>
              <Button variant="ghost" size="sm" icon={Pencil} onClick={() => openEdit(i)} aria-label="Edit override">
                {''}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={Trash2}
                disabled={saving}
                onClick={() => handleDelete(i)}
                aria-label="Delete override"
              >
                {''}
              </Button>
            </div>
          </div>
        );
      })}

      <div>
        <Button variant="secondary" size="sm" icon={Plus} onClick={openCreate} disabled={saving}>
          {t('agents.configVariables.addCustomVariable')}
        </Button>
      </div>

      {editing && (
        <Modal
          isOpen={!!editing}
          onClose={() => setEditing(null)}
          title={
            editing.index === null
              ? t('agents.configVariables.addCustomVariable')
              : t('agents.configVariables.editCustomVariable')
          }
          size="md"
        >
          <div className={styles.modalForm}>
            <div className={styles.modalRow}>
              <label className={styles.modalLabel}>
                {t('agents.configVariables.fields.key')}
                <input
                  type="text"
                  value={editing.entry.key}
                  placeholder="my_variable"
                  onChange={(e) => {
                    setKeyError(null);
                    updateEntry({ key: e.target.value });
                  }}
                />
              </label>
              <label className={styles.modalLabel}>
                {t('agents.configVariables.fields.type')}
                <select
                  value={editing.entry.type}
                  onChange={(e) => updateEntry({ type: e.target.value as ConfigVariableType })}
                >
                  {TYPES.map((tt) => (
                    <option key={tt} value={tt}>
                      {tt}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {keyError && (
              <span className={styles.errorText} role="alert">
                {keyError}
              </span>
            )}

            {templateKeySet.has(editing.entry.key) && editing.index === null && (
              <span className={styles.hint}>
                {t('agents.configVariables.warnReplacesTemplate')}
              </span>
            )}

            <div className={styles.modalRow}>
              <label className={styles.modalLabel}>
                {t('agents.configVariables.fields.labelEn')}
                <input
                  type="text"
                  value={editing.entry.label_en}
                  onChange={(e) => updateEntry({ label_en: e.target.value })}
                />
              </label>
              <label className={styles.modalLabel}>
                {t('agents.configVariables.fields.labelEs')}
                <input
                  type="text"
                  value={editing.entry.label_es}
                  onChange={(e) => updateEntry({ label_es: e.target.value })}
                />
              </label>
            </div>

            <div className={styles.modalRow}>
              <label className={styles.modalLabel}>
                {t('agents.configVariables.fields.descriptionEn')}
                <input
                  type="text"
                  value={editing.entry.description_en ?? ''}
                  onChange={(e) => updateEntry({ description_en: e.target.value })}
                />
              </label>
              <label className={styles.modalLabel}>
                {t('agents.configVariables.fields.descriptionEs')}
                <input
                  type="text"
                  value={editing.entry.description_es ?? ''}
                  onChange={(e) => updateEntry({ description_es: e.target.value })}
                />
              </label>
            </div>

            <label className={styles.modalLabel}>
              {t('agents.configVariables.fields.defaultValue')}
              {editing.entry.type === 'boolean' ? (
                <Toggle
                  checked={editing.entry.default === true}
                  onChange={(checked) => updateEntry({ default: checked })}
                />
              ) : (
                <input
                  type={editing.entry.type === 'number' ? 'number' : 'text'}
                  value={editing.entry.default === null || editing.entry.default === undefined ? '' : String(editing.entry.default)}
                  onChange={(e) => {
                    if (e.target.value === '') return updateEntry({ default: null });
                    if (editing.entry.type === 'number') {
                      const n = Number(e.target.value);
                      updateEntry({ default: Number.isNaN(n) ? e.target.value : n });
                    } else {
                      updateEntry({ default: e.target.value });
                    }
                  }}
                />
              )}
            </label>

            <label
              className={styles.modalLabel}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <Toggle
                checked={editing.entry.required}
                onChange={(checked) => updateEntry({ required: checked })}
              />
              {t('agents.configVariables.fields.required')}
            </label>

            {editing.entry.type === 'enum' && (
              <div>
                <span className={styles.modalLabel}>
                  {t('agents.configVariables.fields.options')}
                </span>
                <div className={styles.optionsList} style={{ marginTop: 8 }}>
                  {(editing.entry.options ?? []).map((opt, i) => (
                    <div key={i} className={styles.optionRow}>
                      <input
                        type="text"
                        placeholder="value"
                        value={opt.value}
                        onChange={(e) => updateOption(i, { value: e.target.value })}
                      />
                      <input
                        type="text"
                        placeholder="Label (EN)"
                        value={opt.label_en}
                        onChange={(e) => updateOption(i, { label_en: e.target.value })}
                      />
                      <input
                        type="text"
                        placeholder="Etiqueta (ES)"
                        value={opt.label_es}
                        onChange={(e) => updateOption(i, { label_es: e.target.value })}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        onClick={() => removeOption(i)}
                        aria-label="Remove option"
                      >
                        {''}
                      </Button>
                    </div>
                  ))}
                  <Button variant="secondary" size="sm" icon={Plus} onClick={addOption}>
                    {t('agents.configVariables.fields.addOption')}
                  </Button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <Button variant="secondary" onClick={() => setEditing(null)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSaveModal} loading={saving}>
                {t('agents.configVariables.saveOverrides')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
