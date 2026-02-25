'use client';

import { useState } from 'react';
import { Wand2, Variable, Wrench, AlertTriangle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { api } from '@/lib/api';
import styles from './PromptGenerator.module.css';

interface SuggestedVariable {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
  options?: string[];
}

interface GenerateResult {
  systemPrompt: string;
  suggestedVariables: SuggestedVariable[];
  suggestedTools: string[];
}

interface PromptGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (result: { prompt: string; variables: SuggestedVariable[]; tools: string[] }) => void;
  currentPrompt?: string;
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
];

export function PromptGenerator({ isOpen, onClose, onApply, currentPrompt }: PromptGeneratorProps) {
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<GenerateResult | null>(null);

  const handleGenerate = async () => {
    const trimmed = description.trim();
    if (trimmed.length < 10) {
      setError('Please provide at least 10 characters describing your agent.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const data = await api.post<GenerateResult>('/api/agents/generate-prompt', {
        description: trimmed,
        language,
      });
      setResult(data);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Failed to generate prompt. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const hasExistingPrompt = !!(currentPrompt && currentPrompt.trim().length > 0);

  const handleApplyPrompt = () => {
    if (!result) return;
    if (hasExistingPrompt && !confirm('This will replace your current prompt. Continue?')) return;
    onApply({ prompt: result.systemPrompt, variables: [], tools: [] });
    onClose();
  };

  const handleApplyVariables = () => {
    if (!result) return;
    onApply({ prompt: '', variables: result.suggestedVariables, tools: [] });
    onClose();
  };

  const handleApplyAll = () => {
    if (!result) return;
    if (hasExistingPrompt && !confirm('This will replace your current prompt. Continue?')) return;
    onApply({
      prompt: result.systemPrompt,
      variables: result.suggestedVariables,
      tools: result.suggestedTools,
    });
    onClose();
  };

  const handleClose = () => {
    setDescription('');
    setError('');
    setResult(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="AI Prompt Generator" size="lg">
      <div className={styles.container}>
        {/* Language row */}
        <div className={styles.topRow}>
          <span className={styles.topRowLabel}>Generate prompt in:</span>
          <div className={styles.langGroup}>
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                className={[styles.langBtn, language === lang.code ? styles.langBtnActive : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setLanguage(lang.code)}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Description textarea */}
        <div className={styles.textareaWrapper}>
          <label className={styles.textareaLabel} htmlFor="pg-description">
            Describe your agent
          </label>
          <textarea
            id="pg-description"
            className={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. A customer support agent for an e-commerce store that helps users track orders, process returns, and answer product questions."
            maxLength={1000}
          />
          <span className={styles.textareaHint}>{description.length}/1000</span>
        </div>

        {error && (
          <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-danger)' }}>{error}</p>
        )}

        {/* Generate button */}
        <div className={styles.generateRow}>
          <Button
            variant="primary"
            icon={loading ? undefined : Wand2}
            onClick={handleGenerate}
            disabled={loading || description.trim().length < 10}
          >
            {loading ? (
              <>
                <Spinner size="sm" />
                <span style={{ marginLeft: '0.5rem' }}>Generating…</span>
              </>
            ) : (
              'Generate Prompt'
            )}
          </Button>
        </div>

        {/* Result preview */}
        {result && (
          <div className={styles.resultSection}>
            {/* Overwrite warning */}
            {hasExistingPrompt && (
              <div className={styles.overwriteWarning}>
                <AlertTriangle size={14} aria-hidden="true" />
                Applying a prompt will replace your current prompt
              </div>
            )}

            <p className={styles.resultTitle}>Generated System Prompt</p>
            <div className={styles.promptPreview}>{result.systemPrompt}</div>

            {/* Suggested variables */}
            <div className={styles.chipsSection}>
              <span className={styles.chipsLabel}>
                <Variable size={12} aria-hidden="true" style={{ display: 'inline', marginRight: '0.25rem', verticalAlign: 'middle' }} />
                Suggested Variables ({result.suggestedVariables.length})
              </span>
              {result.suggestedVariables.length > 0 ? (
                <div className={styles.chips}>
                  {result.suggestedVariables.map((v) => (
                    <span key={v.name} className={styles.chip}>
                      {v.name}
                      {v.required && (
                        <span style={{ color: 'var(--color-danger)', marginLeft: '0.1rem' }}>*</span>
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <p className={styles.noChips}>No variables suggested</p>
              )}
            </div>

            {/* Suggested tools */}
            <div className={styles.chipsSection}>
              <span className={styles.chipsLabel}>
                <Wrench size={12} aria-hidden="true" style={{ display: 'inline', marginRight: '0.25rem', verticalAlign: 'middle' }} />
                Suggested Tools ({result.suggestedTools.length})
              </span>
              {result.suggestedTools.length > 0 ? (
                <div className={styles.chips}>
                  {result.suggestedTools.map((t) => (
                    <span key={t} className={[styles.chip, styles.chipTool].join(' ')}>
                      {t}
                    </span>
                  ))}
                </div>
              ) : (
                <p className={styles.noChips}>No tools suggested</p>
              )}
            </div>

            {/* Apply actions */}
            <div className={styles.applyActions}>
              <span className={styles.applyHint}>Apply to your agent:</span>
              <Button variant="ghost" size="sm" onClick={handleApplyPrompt}>
                Apply Prompt
              </Button>
              {result.suggestedVariables.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleApplyVariables}>
                  Apply Variables
                </Button>
              )}
              <Button variant="primary" size="sm" onClick={handleApplyAll}>
                Apply All
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
