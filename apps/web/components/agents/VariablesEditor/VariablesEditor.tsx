'use client';

import React, { useState } from 'react';
import { Plus, ChevronDown, ChevronUp, Trash2, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Toggle from '@/components/ui/Toggle';
import styles from './VariablesEditor.module.css';

interface AgentVariable {
  name: string;
  type: 'string' | 'enum' | 'number' | 'boolean';
  required: boolean;
  description: string;
  options?: string[];
}

interface VariablesEditorProps {
  variables: AgentVariable[];
  onChange: (variables: AgentVariable[]) => void;
}

function buildInjectionPreview(variables: AgentVariable[]): string {
  if (variables.length === 0) return '(No variables configured)';
  const lines = [
    'During the conversation, naturally capture these variables:',
    ...variables.map((v) => {
      const typeLabel = v.type === 'enum' && v.options?.length
        ? `enum: ${v.options.join('/')}`
        : v.type;
      const reqLabel = v.required ? 'REQUIRED' : 'OPTIONAL';
      return `- ${v.name} (${typeLabel}, ${reqLabel}): ${v.description}`;
    }),
    '',
    'When you capture a variable, call the capture_variable tool with the variable name and value.',
  ];
  return lines.join('\n');
}

export default function VariablesEditor({ variables, onChange }: VariablesEditorProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [newOption, setNewOption] = useState('');

  function addVariable() {
    const newVar: AgentVariable = {
      name: `variable_${variables.length + 1}`,
      type: 'string',
      required: false,
      description: '',
    };
    const updated = [...variables, newVar];
    onChange(updated);
    setExpandedIdx(updated.length - 1);
  }

  function updateVariable(idx: number, patch: Partial<AgentVariable>) {
    const updated = variables.map((v, i) => (i === idx ? { ...v, ...patch } : v));
    onChange(updated);
  }

  function deleteVariable(idx: number) {
    onChange(variables.filter((_, i) => i !== idx));
    if (expandedIdx === idx) setExpandedIdx(null);
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    const updated = [...variables];
    [updated[idx - 1], updated[idx]] = [updated[idx]!, updated[idx - 1]!];
    onChange(updated);
    setExpandedIdx(idx - 1);
  }

  function moveDown(idx: number) {
    if (idx === variables.length - 1) return;
    const updated = [...variables];
    [updated[idx], updated[idx + 1]] = [updated[idx + 1]!, updated[idx]!];
    onChange(updated);
    setExpandedIdx(idx + 1);
  }

  function addOption(idx: number) {
    const opt = newOption.trim();
    if (!opt) return;
    const current = variables[idx]?.options ?? [];
    if (!current.includes(opt)) {
      updateVariable(idx, { options: [...current, opt] });
    }
    setNewOption('');
  }

  function removeOption(varIdx: number, opt: string) {
    const current = variables[varIdx]?.options ?? [];
    updateVariable(varIdx, { options: current.filter((o) => o !== opt) });
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Variables ({variables.length})</span>
        <Button size="sm" variant="secondary" icon={Plus} onClick={addVariable}>
          Add Variable
        </Button>
      </div>

      {variables.length === 0 ? (
        <div className={styles.emptyState}>
          No variables configured. Variables let your agent capture structured data from conversations.
        </div>
      ) : (
        <div className={styles.list}>
          {variables.map((v, idx) => (
            <div key={idx} className={styles.variableRow}>
              <div
                className={`${styles.variableHeader} ${expandedIdx === idx ? styles.expanded : ''}`}
                onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') setExpandedIdx(expandedIdx === idx ? null : idx); }}
              >
                <div className={styles.moveButtons}>
                  <button
                    className={styles.moveBtn}
                    onClick={(e) => { e.stopPropagation(); moveUp(idx); }}
                    disabled={idx === 0}
                    aria-label="Move up"
                  >▲</button>
                  <button
                    className={styles.moveBtn}
                    onClick={(e) => { e.stopPropagation(); moveDown(idx); }}
                    disabled={idx === variables.length - 1}
                    aria-label="Move down"
                  >▼</button>
                </div>
                <span className={styles.variableName}>{v.name || '(unnamed)'}</span>
                <div className={styles.variableBadges}>
                  <Badge variant="info" size="sm">{v.type}</Badge>
                  {v.required && <Badge variant="warning" size="sm">required</Badge>}
                </div>
                {expandedIdx === idx ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <button
                  className={styles.deleteBtn}
                  onClick={(e) => { e.stopPropagation(); deleteVariable(idx); }}
                  aria-label="Delete variable"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {expandedIdx === idx && (
                <div className={styles.variableEditor}>
                  <div className={styles.formRow}>
                    <Input
                      label="Variable Name (snake_case)"
                      value={v.name}
                      onChange={(e) => updateVariable(idx, { name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                      placeholder="full_name"
                    />
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Type</label>
                      <select
                        className={styles.select}
                        value={v.type}
                        onChange={(e) => updateVariable(idx, { type: e.target.value as AgentVariable['type'] })}
                      >
                        <option value="string">string</option>
                        <option value="enum">enum (multiple choice)</option>
                        <option value="number">number</option>
                        <option value="boolean">boolean</option>
                      </select>
                    </div>
                  </div>

                  <Input
                    label="Description (shown to LLM)"
                    value={v.description}
                    onChange={(e) => updateVariable(idx, { description: e.target.value })}
                    placeholder="Full name of the lead"
                  />

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <span className={styles.fieldLabel}>Required</span>
                    <Toggle
                      checked={v.required}
                      onChange={(checked) => updateVariable(idx, { required: checked })}
                    />
                  </div>

                  {v.type === 'enum' && (
                    <div className={styles.optionsContainer}>
                      <span className={styles.fieldLabel}>Options</span>
                      {(v.options ?? []).length > 0 && (
                        <div className={styles.optionsList}>
                          {(v.options ?? []).map((opt) => (
                            <span key={opt} className={styles.optionChip}>
                              {opt}
                              <button
                                className={styles.removeOptionBtn}
                                onClick={() => removeOption(idx, opt)}
                                aria-label={`Remove option ${opt}`}
                              >
                                <X size={10} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className={styles.addOptionRow}>
                        <input
                          className={styles.addOptionInput}
                          value={newOption}
                          onChange={(e) => setNewOption(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption(idx); } }}
                          placeholder="Add option, press Enter"
                        />
                        <Button size="sm" variant="secondary" onClick={() => addOption(idx)}>Add</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Injection Preview */}
      {variables.length > 0 && (
        <div className={styles.preview}>
          <div className={styles.previewTitle}>LLM Injection Preview</div>
          <pre className={styles.previewCode}>{buildInjectionPreview(variables)}</pre>
        </div>
      )}
    </div>
  );
}
