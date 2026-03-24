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
import WidgetCustomizer from '@/components/agents/WidgetCustomizer/WidgetCustomizer';
import WhatsAppConfig from '@/components/agents/WhatsAppConfig/WhatsAppConfig';
import { useTranslation } from '@/hooks/useTranslation';
import { formatDate } from '@/lib/formatters';
import EditorTour from '@/components/onboarding/EditorTour';
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

interface WebConfig {
  primary_color: string;
  welcome_message: string;
  bubble_text: string;
  position: 'bottom-right' | 'bottom-left';
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
  webConfig?: WebConfig | null;
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

export default function AgentEditorPage() {
  const routeParams = useParams();
  const agentId = routeParams['id'] as string;

  const router = useRouter();
  const { success, error: toastError } = useToast();
  const { t, language } = useTranslation();
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
  const [webConfig, setWebConfig] = useState<WebConfig>({
    primary_color: '#25D366',
    welcome_message: 'Hello! How can I help you?',
    bubble_text: 'Chat with us',
    position: 'bottom-right',
  });

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
      if (a.webConfig) {
        setWebConfig({
          primary_color: a.webConfig.primary_color ?? '#25D366',
          welcome_message: a.webConfig.welcome_message ?? 'Hello! How can I help you?',
          bubble_text: a.webConfig.bubble_text ?? 'Chat with us',
          position: (a.webConfig.position as 'bottom-right' | 'bottom-left') ?? 'bottom-right',
        });
      }
    } catch {
      toastError(t('agents.editor.loadFailed'));
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
      const data = await api.get<{ plan: string }>('/api/organization');
      const plan = data.plan as PlanKey;
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
        webConfig,
      });
      setAgent(updated.agent);
      setChannels(updated.agent.channels ?? []);
      setIsDirty(false);
      success(t('agents.editor.saved'));
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : t('agents.editor.saveFailed'));
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
        messageBufferSeconds: bufferSeconds, channels, webConfig,
      });
      const result = await api.post<{ agent: Agent; version: number }>(
        `/api/agents/${agentId}/publish`,
        {}
      );
      setAgent(result.agent);
      setChannels(result.agent.channels ?? []);
      setIsDirty(false);
      setShowPublishModal(false);
      success(t('agents.editor.published', { version: String(result.version) }), t('agents.editor.publishedLive'));
      loadVersions();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : t('agents.editor.publishFailed'));
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
      success(t('agents.editor.rolledBack', { version: String(version.version) }));
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : t('agents.editor.rollbackFailed'));
    } finally {
      setRolling(false);
    }
  }

  async function toggleChannel(ch: string) {
    const newChannels = channels.includes(ch)
      ? channels.filter((c) => c !== ch)
      : [...channels, ch];

    setChannels(newChannels);
    setAgent((prev) =>
      prev ? { ...prev, channels: newChannels } : prev
    );

    // Auto-save channels immediately so the toggle persists without requiring Save
    try {
      await api.put(`/api/agents/${agentId}`, { channels: newChannels });
    } catch {
      // Revert on error
      setChannels(channels);
      setAgent((prev) => prev ? { ...prev, channels } : prev);
      toastError(t('agents.editor.channelFailed'));
    }
  }

  // Avatar upload
  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toastError(t('agents.editor.avatarSizeFailed'));
      return;
    }
    if (!file.type.startsWith('image/')) {
      toastError(t('agents.editor.avatarTypeFailed'));
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
      success(t('agents.editor.avatarUpdated'));
    } catch {
      toastError(t('agents.editor.avatarFailed'));
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
      ? t('agents.editor.settings.noModels')
      : null;

  const EDITOR_TABS = [
    { id: 'prompt', label: t('agents.editor.tabs.prompt') },
    { id: 'variables', label: t('agents.editor.tabs.variables') },
    { id: 'tools', label: t('agents.editor.tabs.tools') },
    { id: 'settings', label: t('agents.editor.tabs.settings') },
    { id: 'channels', label: t('agents.editor.tabs.channels') },
    { id: 'versions', label: t('agents.editor.tabs.versions') },
  ];

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
      <EditorTour />
      {isDirty && (
        <div className={styles.unsavedBanner}>
          <AlertCircle size={14} /> {t('agents.editor.unsavedChanges')}
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
          {t(`agents.editor.status.${agent.status}`)}
        </Badge>
        <div className={styles.headerActions}>
          <Button variant="secondary" size="sm" icon={Save} onClick={handleSave} loading={saving}>
            {t('agents.editor.save')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={Play}
            onClick={() => { setPreviewMessages([]); setShowPreview(true); }}
            data-tour="preview-chat"
          >
            {t('agents.editor.preview')}
          </Button>
          <Button size="sm" icon={Rocket} onClick={() => setShowPublishModal(true)} data-tour="publish-btn">
            {t('agents.editor.publish')}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={EDITOR_TABS} activeTab={activeTab} onChange={setActiveTab}>
        {activeTab === 'prompt' && (
          <div className={styles.tabContent}>
            <div className={styles.promptSection} data-tour="prompt-editor">
              <div className={styles.promptToolbar}>
                <span className={styles.promptLabel}>{t('agents.editor.prompt.label')}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Upload}
                  onClick={() => setShowPromptGen(true)}
                >
                  {t('agents.editor.prompt.generate')}
                </Button>
              </div>
              <textarea
                className={styles.promptTextarea}
                value={systemPrompt}
                onChange={(e) => { setSystemPrompt(e.target.value); setIsDirty(true); }}
                placeholder={t('agents.editor.prompt.placeholder')}
                spellCheck={false}
              />
              <div className={styles.promptMeta}>
                {t('agents.editor.prompt.characters', { count: String(systemPrompt.length) })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'variables' && (
          <div className={styles.tabContent} data-tour="variables-tab">
            <VariablesEditor
              variables={variables}
              onChange={(v) => { setVariables(v); setIsDirty(true); }}
            />
          </div>
        )}

        {activeTab === 'tools' && (
          <div className={styles.tabContent}>
            {!orgPlanLoaded ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <Spinner />
              </div>
            ) : (
              <ToolConfigurator agentId={agentId} orgPlan={orgPlan} orgPlanLoaded={orgPlanLoaded} />
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className={styles.tabContent}>
            <div className={styles.settingsGrid}>
              <div className={styles.settingsSection}>
                <div className={styles.settingsSectionTitle}>{t('agents.editor.settings.llmConfig')}</div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>{t('agents.editor.settings.provider')}</label>
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
                  <label className={styles.fieldLabel}>{t('agents.editor.settings.model')}</label>
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
                      <option value="" disabled>{t('agents.editor.settings.noModels')}</option>
                    )}
                  </select>
                  {filteredModels.length === 0 && (
                    <span className={styles.fieldHint} style={{ color: 'var(--color-danger)' }}>
                      {t('agents.editor.settings.upgradeModel', { provider: llmProvider === 'anthropic' ? 'Anthropic' : 'OpenAI GPT-4o' })}
                    </span>
                  )}
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>
                    {t('agents.editor.settings.temperature')}: <span style={{ color: 'var(--color-primary)' }}>{temperature.toFixed(1)}</span>
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
                  <span className={styles.fieldHint}>{t('agents.editor.settings.temperatureHint')}</span>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>{t('agents.editor.settings.maxTokens')}</label>
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
                    {t('agents.editor.settings.planMax', { max: String(planLimits.maxTokensPerResponse) })}
                  </span>
                </div>
              </div>

              <div className={styles.settingsSection}>
                <div className={styles.settingsSectionTitle}>{t('agents.editor.settings.conversation')}</div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>{t('agents.editor.settings.contextWindow')}</label>
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
                    {t('agents.editor.settings.planMax', { max: String(planLimits.contextWindowMessages) })}
                  </span>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>
                    {t('agents.editor.settings.messageBuffer')}: <span style={{ color: 'var(--color-primary)' }}>{bufferSeconds}s</span>
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
                  <span className={styles.fieldHint}>{t('agents.editor.settings.messageBufferHint')}</span>
                </div>

                <div className={styles.settingsSectionTitle} style={{ marginTop: '0.5rem' }}>{t('agents.editor.settings.channels')}</div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className={styles.fieldLabel}>{t('agents.editor.channels.webWidget')}</span>
                    <Toggle
                      checked={channels.includes('web')}
                      onChange={(_checked) => toggleChannel('web')}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className={styles.fieldLabel}>{t('agents.editor.channels.whatsapp')}</span>
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

        {activeTab === 'channels' && (
          <div className={styles.tabContent} data-tour="channels-section">
            <div className={styles.channelsGrid}>
              {/* Web Widget */}
              <div className={styles.channelSection}>
                <div className={styles.channelHeader}>
                  <div className={styles.channelToggleRow}>
                    <div>
                      <div className={styles.settingsSectionTitle}>{t('agents.editor.channels.webWidget')}</div>
                      <span className={styles.channelDesc}>{t('agents.editor.channels.webDesc')}</span>
                    </div>
                    <Toggle
                      checked={channels.includes('web')}
                      onChange={(_checked) => toggleChannel('web')}
                    />
                  </div>
                </div>
                {channels.includes('web') && orgPlanLoaded && (
                  <div className={styles.channelBody} data-tour="snippet-section">
                    <WidgetCustomizer
                      agentId={agentId}
                      initialConfig={webConfig}
                      channels={channels}
                      onSaved={(cfg: WebConfig) => setWebConfig(cfg)}
                    />
                  </div>
                )}
                {!channels.includes('web') && (
                  <p className={styles.channelOffHint}>{t('agents.editor.channels.webOffHint')}</p>
                )}
              </div>

              {/* WhatsApp */}
              <div className={styles.channelSection}>
                <div className={styles.channelHeader}>
                  <div className={styles.channelToggleRow}>
                    <div>
                      <div className={styles.settingsSectionTitle}>{t('agents.editor.channels.whatsapp')}</div>
                      <span className={styles.channelDesc}>{t('agents.editor.channels.whatsappDesc')}</span>
                    </div>
                    <Toggle
                      checked={channels.includes('whatsapp')}
                      onChange={(_checked) => toggleChannel('whatsapp')}
                      disabled={orgPlan === 'free'}
                    />
                  </div>
                </div>
                {orgPlanLoaded && (
                  <div className={styles.channelBody}>
                    <WhatsAppConfig agentId={agentId} orgPlan={orgPlan} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'versions' && (
          <div className={styles.tabContent}>
            {versions.length === 0 ? (
              <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)', textAlign: 'center', padding: '2rem' }}>
                {t('agents.editor.versions.noVersions')}
              </p>
            ) : (
              <div className={styles.versionsList}>
                {versions.map((v) => (
                  <div key={v.id} className={styles.versionRow}>
                    <span className={styles.versionNumber}>v{v.version}</span>
                    <div className={styles.versionMeta}>
                      <div className={styles.versionDate}>
                        {formatDate(v.published_at, language)}
                      </div>
                      {v.publisher_name && (
                        <div className={styles.versionPublisher}>{t('agents.editor.versions.by', { name: v.publisher_name })}</div>
                      )}
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={RotateCcw}
                      onClick={() => setRollbackTarget(v)}
                    >
                      {t('agents.editor.versions.rollback')}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Tabs>

      {/* Publish Modal */}
      <Modal isOpen={showPublishModal} onClose={() => setShowPublishModal(false)} title={t('agents.editor.publishTitle')} size="sm">
        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)', marginBottom: '1.25rem' }}>
          {t('agents.editor.publishConfirm')}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setShowPublishModal(false)}>{t('common.cancel')}</Button>
          <Button icon={Check} loading={publishing} onClick={handlePublish}>{t('agents.editor.publish')}</Button>
        </div>
      </Modal>

      {/* Rollback Modal */}
      <Modal isOpen={!!rollbackTarget} onClose={() => setRollbackTarget(null)} title={t('agents.editor.rollbackTitle', { version: String(rollbackTarget?.version ?? '') })} size="sm">
        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)', marginBottom: '1.25rem' }}>
          {t('agents.editor.rollbackConfirm', { version: String(rollbackTarget?.version ?? '') })}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setRollbackTarget(null)}>{t('common.cancel')}</Button>
          <Button
            icon={RotateCcw}
            loading={rolling}
            onClick={() => rollbackTarget && handleRollback(rollbackTarget)}
          >
            {t('agents.editor.versions.rollback')}
          </Button>
        </div>
      </Modal>

      {/* Preview Modal */}
      <Modal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title={t('agents.editor.preview')}
        size="lg"
      >
        <div className={styles.previewContainer}>
          <div className={styles.previewBanner}>
            {t('agents.editor.previewModal.banner')}
          </div>
          <div className={styles.previewMessages}>
            {previewMessages.length === 0 && (
              <p className={styles.previewEmpty}>{t('agents.editor.previewModal.empty')}</p>
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
              <strong>{t('agents.editor.previewModal.capturedVars')}</strong>{' '}
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
              placeholder={t('agents.editor.previewModal.inputPlaceholder')}
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
              {t('agents.editor.previewModal.send')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Trash2}
              onClick={() => void handlePreviewReset()}
              disabled={previewMessages.length === 0}
            >
              {t('agents.editor.previewModal.reset')}
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
            const mapped = suggestedVars.map((v) => ({
              name: v.name,
              type: (v.type as AgentVariable['type']) || 'string',
              required: v.required ?? false,
              description: v.description ?? '',
              options: v.options,
            }));
            setVariables(mergeVariables(variables, mapped));
            setIsDirty(true);
          }
        }}
      />
    </div>
  );
}
