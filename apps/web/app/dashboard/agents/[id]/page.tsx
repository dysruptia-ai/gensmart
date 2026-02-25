'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Save, Upload, Check, RotateCcw, AlertCircle, Rocket,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Tabs from '@/components/ui/Tabs';
import Spinner from '@/components/ui/Spinner';
import Input from '@/components/ui/Input';
import Toggle from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';
import VariablesEditor from '@/components/agents/VariablesEditor';
import ToolConfigurator from '@/components/agents/ToolConfigurator';
import { PromptGenerator } from '@/components/agents/PromptGenerator';
import styles from './editor.module.css';

interface AgentVariable {
  name: string;
  type: 'string' | 'enum' | 'number' | 'boolean';
  required: boolean;
  description: string;
  options?: string[];
}

interface AgentVersion {
  id: string;
  version: number;
  published_at: string;
  publisher_name?: string | null;
}

interface Agent {
  id: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  avatarInitials?: string;
  systemPrompt: string;
  llmProvider: string;
  llmModel: string;
  temperature: number;
  maxTokens: number;
  contextWindowMessages: number;
  status: 'draft' | 'active' | 'paused';
  channels: string[];
  messageBufferSeconds: number;
  variables: AgentVariable[];
  publishedAt?: string | null;
}

const LLM_PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
];

const OPENAI_MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4o', label: 'GPT-4o' },
];

const ANTHROPIC_MODELS = [
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet' },
];

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'neutral'> = {
  active: 'success',
  paused: 'warning',
  draft: 'neutral',
};

const EDITOR_TABS = [
  { id: 'prompt', label: 'Prompt' },
  { id: 'variables', label: 'Variables' },
  { id: 'tools', label: 'Tools' },
  { id: 'settings', label: 'Settings' },
  { id: 'versions', label: 'Versions' },
];

export default function AgentEditorPage() {
  const routeParams = useParams();
  const agentId = routeParams['id'] as string;

  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [versions, setVersions] = useState<AgentVersion[]>([]);
  const [rollbackTarget, setRollbackTarget] = useState<AgentVersion | null>(null);
  const [rolling, setRolling] = useState(false);
  const [showPromptGen, setShowPromptGen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [activeTab, setActiveTab] = useState('prompt');

  // Local editable fields
  const [name, setName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [variables, setVariables] = useState<AgentVariable[]>([]);
  const [llmProvider, setLlmProvider] = useState('openai');
  const [llmModel, setLlmModel] = useState('gpt-4o-mini');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [contextWindow, setContextWindow] = useState(15);
  const [bufferSeconds, setBufferSeconds] = useState(5);
  const [channels, setChannels] = useState<string[]>([]);

  const loadAgent = useCallback(async () => {
    try {
      const data = await api.get<{ agent: Agent }>(`/api/agents/${agentId}`);
      const a = data.agent;
      setAgent(a);
      setName(a.name);
      setSystemPrompt(a.systemPrompt);
      setVariables(a.variables ?? []);
      setLlmProvider(a.llmProvider);
      setLlmModel(a.llmModel);
      setTemperature(a.temperature);
      setMaxTokens(a.maxTokens);
      setContextWindow(a.contextWindowMessages);
      setBufferSeconds(a.messageBufferSeconds);
      setChannels(a.channels ?? []);
    } catch {
      toastError('Failed to load agent');
      router.push('/dashboard/agents');
    } finally {
      setLoading(false);
    }
  }, [agentId, toastError, router]);

  const loadVersions = useCallback(async () => {
    try {
      const data = await api.get<{ versions: AgentVersion[] }>(`/api/agents/${agentId}/versions`);
      setVersions(data.versions);
    } catch {
      // non-critical
    }
  }, [agentId]);

  useEffect(() => { loadAgent(); loadVersions(); }, [loadAgent, loadVersions]);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.put<{ agent: Agent }>(`/api/agents/${agentId}`, {
        name,
        systemPrompt,
        variables,
        llmProvider,
        llmModel,
        temperature,
        maxTokens,
        contextWindowMessages: contextWindow,
        messageBufferSeconds: bufferSeconds,
        channels,
      });
      setAgent(updated.agent);
      setIsDirty(false);
      success('Changes saved');
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      // Save first
      await api.put<{ agent: Agent }>(`/api/agents/${agentId}`, {
        name, systemPrompt, variables, llmProvider, llmModel,
        temperature, maxTokens, contextWindowMessages: contextWindow,
        messageBufferSeconds: bufferSeconds, channels,
      });
      const result = await api.post<{ agent: Agent; version: number }>(
        `/api/agents/${agentId}/publish`,
        {}
      );
      setAgent(result.agent);
      setIsDirty(false);
      setShowPublishModal(false);
      success(`Agent published as v${result.version}`, 'Your agent is now live.');
      loadVersions();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Failed to publish');
    } finally {
      setPublishing(false);
    }
  }

  async function handleRollback(version: AgentVersion) {
    setRolling(true);
    try {
      const data = await api.post<{ agent: Agent }>(
        `/api/agents/${agentId}/rollback/${version.id}`,
        {}
      );
      const a = data.agent;
      setAgent(a);
      setSystemPrompt(a.systemPrompt);
      setVariables(a.variables ?? []);
      setLlmProvider(a.llmProvider);
      setLlmModel(a.llmModel);
      setTemperature(a.temperature);
      setMaxTokens(a.maxTokens);
      setContextWindow(a.contextWindowMessages);
      setIsDirty(false);
      setRollbackTarget(null);
      success(`Rolled back to v${version.version}`);
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Failed to rollback');
    } finally {
      setRolling(false);
    }
  }

  function toggleChannel(ch: string) {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
    setIsDirty(true);
  }

  const models = llmProvider === 'anthropic' ? ANTHROPIC_MODELS : OPENAI_MODELS;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!agent) return null;

  return (
    <div className={styles.page}>
      {isDirty && (
        <div className={styles.unsavedBanner}>
          <AlertCircle size={14} /> Unsaved changes
        </div>
      )}

      {/* Header */}
      <div className={styles.editorHeader}>
        <div className={styles.agentAvatar}>
          <Avatar name={agent.avatarInitials ?? agent.name} size="md" src={agent.avatarUrl ?? undefined} />
        </div>
        <div className={styles.agentMeta}>
          <input
            className={styles.agentNameInput}
            value={name}
            onChange={(e) => { setName(e.target.value); setIsDirty(true); }}
            placeholder="Agent name"
            aria-label="Agent name"
          />
        </div>
        <Badge variant={STATUS_VARIANT[agent.status] ?? 'neutral'} size="sm">
          {agent.status}
        </Badge>
        <div className={styles.headerActions}>
          <Button variant="secondary" size="sm" icon={Save} onClick={handleSave} loading={saving}>
            Save
          </Button>
          <Button size="sm" icon={Rocket} onClick={() => setShowPublishModal(true)}>
            Publish
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={EDITOR_TABS} activeTab={activeTab} onChange={setActiveTab}>
        {activeTab === 'prompt' && (
          <div className={styles.tabContent}>
            <div className={styles.promptSection}>
              <div className={styles.promptToolbar}>
                <span className={styles.promptLabel}>System Prompt</span>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Upload}
                  onClick={() => setShowPromptGen(true)}
                >
                  Generate with AI
                </Button>
              </div>
              <textarea
                className={styles.promptTextarea}
                value={systemPrompt}
                onChange={(e) => { setSystemPrompt(e.target.value); setIsDirty(true); }}
                placeholder="Enter the system prompt for your agent..."
                spellCheck={false}
              />
              <div className={styles.promptMeta}>
                {systemPrompt.length} characters
              </div>
            </div>
          </div>
        )}

        {activeTab === 'variables' && (
          <div className={styles.tabContent}>
            <VariablesEditor
              variables={variables}
              onChange={(v) => { setVariables(v); setIsDirty(true); }}
            />
          </div>
        )}

        {activeTab === 'tools' && (
          <div className={styles.tabContent}>
            <ToolConfigurator agentId={agentId} />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className={styles.tabContent}>
            <div className={styles.settingsGrid}>
              <div className={styles.settingsSection}>
                <div className={styles.settingsSectionTitle}>LLM Configuration</div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Provider</label>
                  <select
                    className={styles.select}
                    value={llmProvider}
                    onChange={(e) => {
                      setLlmProvider(e.target.value);
                      setLlmModel(e.target.value === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-4o-mini');
                      setIsDirty(true);
                    }}
                  >
                    {LLM_PROVIDERS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Model</label>
                  <select
                    className={styles.select}
                    value={llmModel}
                    onChange={(e) => { setLlmModel(e.target.value); setIsDirty(true); }}
                  >
                    {models.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>
                    Temperature: <span style={{ color: 'var(--color-primary)' }}>{temperature.toFixed(1)}</span>
                  </label>
                  <div className={styles.rangeWrapper}>
                    <input
                      type="range"
                      className={styles.rangeInput}
                      min={0} max={2} step={0.1}
                      value={temperature}
                      onChange={(e) => { setTemperature(parseFloat(e.target.value)); setIsDirty(true); }}
                    />
                    <span className={styles.rangeValue}>{temperature.toFixed(1)}</span>
                  </div>
                  <span className={styles.fieldHint}>Lower = more focused, Higher = more creative</span>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Max Tokens</label>
                  <Input
                    type="number"
                    value={String(maxTokens)}
                    onChange={(e) => { setMaxTokens(parseInt(e.target.value, 10) || 1024); setIsDirty(true); }}
                    min="1"
                    max="4096"
                  />
                </div>
              </div>

              <div className={styles.settingsSection}>
                <div className={styles.settingsSectionTitle}>Conversation</div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Context Window Messages</label>
                  <Input
                    type="number"
                    value={String(contextWindow)}
                    onChange={(e) => { setContextWindow(parseInt(e.target.value, 10) || 15); setIsDirty(true); }}
                    min="1"
                    max="50"
                  />
                  <span className={styles.fieldHint}>Number of past messages to include as context</span>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>
                    Message Buffer: <span style={{ color: 'var(--color-primary)' }}>{bufferSeconds}s</span>
                  </label>
                  <div className={styles.rangeWrapper}>
                    <input
                      type="range"
                      className={styles.rangeInput}
                      min={0} max={30} step={1}
                      value={bufferSeconds}
                      onChange={(e) => { setBufferSeconds(parseInt(e.target.value, 10)); setIsDirty(true); }}
                    />
                    <span className={styles.rangeValue}>{bufferSeconds}s</span>
                  </div>
                  <span className={styles.fieldHint}>Wait time before processing a user&apos;s message</span>
                </div>

                <div className={styles.settingsSectionTitle} style={{ marginTop: '0.5rem' }}>Channels</div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className={styles.fieldLabel}>Web Widget</span>
                    <Toggle
                      checked={channels.includes('web')}
                      onChange={(_checked) => toggleChannel('web')}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className={styles.fieldLabel}>WhatsApp</span>
                    <Toggle
                      checked={channels.includes('whatsapp')}
                      onChange={(_checked) => toggleChannel('whatsapp')}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'versions' && (
          <div className={styles.tabContent}>
            {versions.length === 0 ? (
              <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)', textAlign: 'center', padding: '2rem' }}>
                No versions yet. Publish your agent to create the first version.
              </p>
            ) : (
              <div className={styles.versionsList}>
                {versions.map((v) => (
                  <div key={v.id} className={styles.versionRow}>
                    <span className={styles.versionNumber}>v{v.version}</span>
                    <div className={styles.versionMeta}>
                      <div className={styles.versionDate}>
                        {new Date(v.published_at).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </div>
                      {v.publisher_name && (
                        <div className={styles.versionPublisher}>by {v.publisher_name}</div>
                      )}
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={RotateCcw}
                      onClick={() => setRollbackTarget(v)}
                    >
                      Rollback
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Tabs>

      {/* Publish Modal */}
      <Modal isOpen={showPublishModal} onClose={() => setShowPublishModal(false)} title="Publish Agent" size="sm">
        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)', marginBottom: '1.25rem' }}>
          Publishing will save your current changes and create a new version. Your agent will go live immediately.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setShowPublishModal(false)}>Cancel</Button>
          <Button icon={Check} loading={publishing} onClick={handlePublish}>Publish Now</Button>
        </div>
      </Modal>

      {/* Rollback Modal */}
      <Modal isOpen={!!rollbackTarget} onClose={() => setRollbackTarget(null)} title="Rollback Agent" size="sm">
        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)', marginBottom: '1.25rem' }}>
          Restore the agent&apos;s prompt and configuration to{' '}
          <strong>v{rollbackTarget?.version}</strong>? Your current unsaved changes will be replaced.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setRollbackTarget(null)}>Cancel</Button>
          <Button
            icon={RotateCcw}
            loading={rolling}
            onClick={() => rollbackTarget && handleRollback(rollbackTarget)}
          >
            Rollback
          </Button>
        </div>
      </Modal>

      {/* Prompt Generator Modal */}
      <PromptGenerator
        isOpen={showPromptGen}
        onClose={() => setShowPromptGen(false)}
        onApply={({ prompt, variables: suggestedVars }) => {
          if (prompt) { setSystemPrompt(prompt); setIsDirty(true); }
          if (suggestedVars.length > 0) {
            setVariables((prev) => [
              ...prev,
              ...suggestedVars.map((v) => ({
                name: v.name,
                type: (v.type as AgentVariable['type']) || 'string',
                required: v.required ?? false,
                description: v.description ?? '',
                options: v.options,
              })),
            ]);
            setIsDirty(true);
          }
        }}
      />
    </div>
  );
}
