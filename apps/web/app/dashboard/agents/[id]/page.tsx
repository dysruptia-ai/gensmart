'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Save, Upload, Check, RotateCcw, AlertCircle, Rocket, Play, Camera, SendHorizonal, Trash2, Wrench,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { PLAN_LIMITS } from '@gensmart/shared';
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

type PlanKey = keyof typeof PLAN_LIMITS;

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

interface PreviewMessage {
  role: 'user' | 'assistant';
  content: string;
  metadata?: {
    tokensUsed?: number;
    latencyMs?: number;
    toolsCalled?: string[];
    capturedVariables?: Record<string, string>;
    model?: string;
  };
}

const ALL_MODELS: { provider: string; value: string; label: string }[] = [
  { provider: 'openai', value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { provider: 'openai', value: 'gpt-4o', label: 'GPT-4o' },
  { provider: 'anthropic', value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku' },
  { provider: 'anthropic', value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet' },
];

const LLM_PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
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
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const previewBottomRef = useRef<HTMLDivElement>(null);
  const previewInputRef = useRef<HTMLInputElement>(null);

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

  // Plan state
  const [orgPlan, setOrgPlan] = useState<PlanKey>('free');
  const [orgPlanLoaded, setOrgPlanLoaded] = useState(false);

  // Preview state — previewPending counts concurrent in-flight requests
  const [showPreview, setShowPreview] = useState(false);
  const [previewMessages, setPreviewMessages] = useState<PreviewMessage[]>([]);
  const [previewInput, setPreviewInput] = useState('');
  const [previewPending, setPreviewPending] = useState(0);

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Local editable fields
  const [name, setName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [variables, setVariables] = useState<AgentVariable[]>([]);
  const [llmProvider, setLlmProvider] = useState('openai');
  const [llmModel, setLlmModel] = useState('gpt-4o-mini');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(512);
  const [contextWindow, setContextWindow] = useState(10);
  const [bufferSeconds, setBufferSeconds] = useState(5);
  const [channels, setChannels] = useState<string[]>([]);

  const planLimits = PLAN_LIMITS[orgPlan];

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
      setAvatarUrl(a.avatarUrl ?? null);
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

  const loadOrgPlan = useCallback(async () => {
    try {
      const data = await api.get<{ organization: { plan: string } }>('/api/organization');
      const plan = data.organization.plan as PlanKey;
      setOrgPlan(plan);
      // Clamp current values to plan limits after loading plan
      const limits = PLAN_LIMITS[plan];
      if (limits) {
        setMaxTokens((prev) => Math.min(prev, limits.maxTokensPerResponse));
        setContextWindow((prev) => Math.min(prev, limits.contextWindowMessages));
      }
    } catch {
      // non-critical — default to free
    } finally {
      setOrgPlanLoaded(true);
    }
  }, []);

  useEffect(() => { loadAgent(); loadVersions(); loadOrgPlan(); }, [loadAgent, loadVersions, loadOrgPlan]);

  // Scroll preview to bottom when new messages arrive
  useEffect(() => {
    previewBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [previewMessages]);

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
        maxTokens: Math.min(maxTokens, planLimits.maxTokensPerResponse),
        contextWindowMessages: Math.min(contextWindow, planLimits.contextWindowMessages),
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
      await api.put<{ agent: Agent }>(`/api/agents/${agentId}`, {
        name, systemPrompt, variables, llmProvider, llmModel,
        temperature, maxTokens: Math.min(maxTokens, planLimits.maxTokensPerResponse),
        contextWindowMessages: Math.min(contextWindow, planLimits.contextWindowMessages),
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

  // Avatar upload
  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toastError('Image must be under 2MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toastError('File must be an image');
      return;
    }
    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const data = await api.upload<{ avatarUrl: string }>(
        `/api/agents/${agentId}/avatar`,
        formData
      );
      setAvatarUrl(data.avatarUrl);
      setAgent((prev) => prev ? { ...prev, avatarUrl: data.avatarUrl } : null);
      success('Avatar updated');
    } catch {
      toastError('Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
      // Reset input so the same file can be selected again
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  }

  // Preview — fire-and-forget: input is never blocked while AI responds
  function handlePreviewSend() {
    const msg = previewInput.trim();
    if (!msg) return;

    // 1. Add user message and clear input immediately
    setPreviewMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setPreviewInput('');
    previewInputRef.current?.focus();

    // 2. Increment pending counter (shows typing indicator)
    setPreviewPending((n) => n + 1);

    // 3. Fire API call — does NOT block the input
    api.post<{
      message: string;
      metadata?: {
        tokensUsed?: number;
        latencyMs?: number;
        toolsCalled?: string[];
        capturedVariables?: Record<string, string>;
        model?: string;
      };
    }>(`/api/agents/${agentId}/preview`, { message: msg, systemPrompt })
      .then((data) => {
        setPreviewMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.message, metadata: data.metadata },
        ]);
      })
      .catch((err) => {
        const errMsg = err instanceof ApiError ? err.message : 'Error generating response';
        setPreviewMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${errMsg}` }]);
      })
      .finally(() => {
        setPreviewPending((n) => n - 1);
      });
  }

  async function handlePreviewReset() {
    setPreviewMessages([]);
    try {
      await api.post(`/api/agents/${agentId}/preview/reset`);
    } catch {
      // ignore
    }
  }

  // Merge variables deduplicating by name (BUG-029)
  function mergeVariables(existing: AgentVariable[], newVars: AgentVariable[]): AgentVariable[] {
    const merged = [...existing];
    for (const newVar of newVars) {
      const idx = merged.findIndex((v) => v.name === newVar.name);
      if (idx >= 0) {
        merged[idx] = { ...merged[idx], ...newVar };
      } else {
        merged.push(newVar);
      }
    }
    return merged;
  }

  // Computed: models filtered by plan
  const allowedModels = (planLimits.allowedModels as readonly string[]);
  const filteredModels = ALL_MODELS.filter(
    (m) => m.provider === llmProvider && allowedModels.includes(m.value)
  );
  const modelWarning =
    llmModel && !allowedModels.includes(llmModel)
      ? `Model "${llmModel}" is not available in your current plan`
      : null;

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

      {/* Hidden avatar file input */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={handleAvatarChange}
      />

      {/* Header */}
      <div className={styles.editorHeader}>
        <div
          className={styles.agentAvatarWrapper}
          onClick={() => !uploadingAvatar && avatarInputRef.current?.click()}
          title="Click to change avatar"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && avatarInputRef.current?.click()}
          aria-label="Change agent avatar"
        >
          <Avatar name={agent.avatarInitials ?? agent.name} size="md" src={avatarUrl ?? undefined} />
          <div className={styles.avatarOverlay}>
            {uploadingAvatar ? <Spinner size="sm" /> : <Camera size={14} />}
          </div>
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
          <Button
            variant="secondary"
            size="sm"
            icon={Play}
            onClick={() => { setPreviewMessages([]); setShowPreview(true); }}
          >
            Preview
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
            <ToolConfigurator agentId={agentId} orgPlan={orgPlan} orgPlanLoaded={orgPlanLoaded} />
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
                      const p = e.target.value;
                      setLlmProvider(p);
                      // Pick first allowed model for this provider
                      const firstAllowed = ALL_MODELS.find(
                        (m) => m.provider === p && allowedModels.includes(m.value)
                      );
                      setLlmModel(firstAllowed?.value ?? (p === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-4o-mini'));
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
                  {modelWarning && (
                    <div className={styles.planWarning}>
                      <AlertCircle size={12} />
                      {modelWarning}
                    </div>
                  )}
                  <select
                    className={styles.select}
                    value={allowedModels.includes(llmModel) ? llmModel : (filteredModels[0]?.value ?? '')}
                    onChange={(e) => { setLlmModel(e.target.value); setIsDirty(true); }}
                  >
                    {filteredModels.length > 0 ? (
                      filteredModels.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))
                    ) : (
                      <option value="" disabled>No models available for this provider in your plan</option>
                    )}
                  </select>
                  {filteredModels.length === 0 && (
                    <span className={styles.fieldHint} style={{ color: 'var(--color-danger)' }}>
                      Upgrade your plan to use {llmProvider === 'anthropic' ? 'Anthropic' : 'OpenAI GPT-4o'} models.
                    </span>
                  )}
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
                    onChange={(e) => {
                      const val = Math.min(parseInt(e.target.value, 10) || 1, planLimits.maxTokensPerResponse);
                      setMaxTokens(val);
                      setIsDirty(true);
                    }}
                    min="1"
                    max={String(planLimits.maxTokensPerResponse)}
                  />
                  <span className={styles.fieldHint}>
                    Max for your plan: {planLimits.maxTokensPerResponse}
                  </span>
                </div>
              </div>

              <div className={styles.settingsSection}>
                <div className={styles.settingsSectionTitle}>Conversation</div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Context Window Messages</label>
                  <Input
                    type="number"
                    value={String(contextWindow)}
                    onChange={(e) => {
                      const val = Math.min(parseInt(e.target.value, 10) || 1, planLimits.contextWindowMessages);
                      setContextWindow(val);
                      setIsDirty(true);
                    }}
                    min="1"
                    max={String(planLimits.contextWindowMessages)}
                  />
                  <span className={styles.fieldHint}>
                    Max for your plan: {planLimits.contextWindowMessages}
                  </span>
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

      {/* Preview Modal */}
      <Modal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title="Agent Preview"
        size="lg"
      >
        <div className={styles.previewContainer}>
          <div className={styles.previewBanner}>
            PREVIEW MODE — Messages are not counted towards your plan usage
          </div>
          <div className={styles.previewMessages}>
            {previewMessages.length === 0 && (
              <p className={styles.previewEmpty}>Send a message to start chatting with your agent.</p>
            )}
            {previewMessages.map((msg, i) => (
              <div
                key={i}
                className={[
                  styles.messageRow,
                  msg.role === 'user' ? styles.messageRowUser : styles.messageRowAssistant,
                ].join(' ')}
              >
                <div
                  className={[
                    styles.previewMessage,
                    msg.role === 'user' ? styles.previewMessageUser : styles.previewMessageAssistant,
                  ].join(' ')}
                >
                  {msg.content}
                </div>
                {msg.role === 'assistant' && msg.metadata && (
                  <div className={styles.previewMeta}>
                    <span>
                      {[
                        msg.metadata.latencyMs ? `${(msg.metadata.latencyMs / 1000).toFixed(1)}s` : '',
                        msg.metadata.tokensUsed ? `${msg.metadata.tokensUsed} tokens` : '',
                        msg.metadata.model ?? '',
                      ].filter(Boolean).join(' · ')}
                    </span>
                    {msg.metadata.toolsCalled?.map((t, ti) => (
                      <span key={ti} className={styles.previewMetaTool}>
                        <Wrench size={9} aria-hidden="true" />{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {previewPending > 0 && (
              <div className={[styles.previewMessage, styles.previewMessageAssistant].join(' ')}>
                <Spinner size="sm" />
              </div>
            )}
            <div ref={previewBottomRef} />
          </div>

          {/* Captured variables from preview */}
          {previewMessages.some((m) => m.metadata?.capturedVariables && Object.keys(m.metadata.capturedVariables).length > 0) && (
            <div className={styles.previewVars}>
              <strong>Captured Variables:</strong>{' '}
              {Object.entries(
                previewMessages.reduce<Record<string, string>>((acc, m) => {
                  if (m.metadata?.capturedVariables) Object.assign(acc, m.metadata.capturedVariables);
                  return acc;
                }, {})
              ).map(([k, v]) => (
                <span key={k} className={styles.previewVarChip}>{k}: <em>{v}</em></span>
              ))}
            </div>
          )}

          <div className={styles.previewInputRow}>
            <input
              ref={previewInputRef}
              className={styles.previewInput}
              value={previewInput}
              onChange={(e) => setPreviewInput(e.target.value)}
              placeholder="Type a message..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePreviewSend(); }
              }}
            />
            <Button
              size="sm"
              icon={SendHorizonal}
              onClick={handlePreviewSend}
              disabled={!previewInput.trim()}
            >
              Send
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Trash2}
              onClick={() => void handlePreviewReset()}
              disabled={previewMessages.length === 0}
            >
              Reset
            </Button>
          </div>
        </div>
      </Modal>

      {/* Prompt Generator Modal */}
      <PromptGenerator
        isOpen={showPromptGen}
        onClose={() => setShowPromptGen(false)}
        currentPrompt={systemPrompt}
        onApply={({ prompt, variables: suggestedVars }) => {
          if (prompt) { setSystemPrompt(prompt); setIsDirty(true); }
          if (suggestedVars.length > 0) {
            setVariables((prev) =>
              mergeVariables(prev, suggestedVars.map((v) => ({
                name: v.name,
                type: (v.type as AgentVariable['type']) || 'string',
                required: v.required ?? false,
                description: v.description ?? '',
                options: v.options,
              })))
            );
            setIsDirty(true);
          }
        }}
      />
    </div>
  );
}
