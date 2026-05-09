'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Plug, Check, X, ChevronDown, ChevronUp, Info,
  Plus, Eye, EyeOff, Copy, RefreshCw, Wrench, ArrowLeft,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { api, ApiError } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import ProviderLogoPlaceholder from './ProviderLogoPlaceholder';
import styles from './MCPConfigurator.module.css';

export interface MCPToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPHeader {
  key: string;
  /** In edit mode: '' means "keep the existing encrypted value untouched". */
  value: string;
}

export interface MCPConfig {
  server_url: string;
  name: string;
  transport: 'sse' | 'streamable-http';
  selected_tools: string[];
  headers: MCPHeader[];
  /** Plain webhook secret. Only set after creation or regeneration. */
  webhookSecret?: string;
  /** When set, this tool is bound to a known provider profile. The
   *  guided UI hides infrastructural fields and only shows the headers
   *  the user must fill in. */
  providerId?: string;
}

/** Public profile shape returned by GET /agents/:id/tools/mcp/providers
 *  (sensitive fields stripped server-side). */
export interface MCPProviderProfile {
  id: string;
  name: string;
  description?: string;
  logo_url?: string;
  default_server_url?: string;
  default_transport: 'sse' | 'streamable-http';
  user_configurable_headers: Array<{
    key: string;
    label_en: string;
    label_es: string;
    help_url?: string;
    help_text_en?: string;
    help_text_es?: string;
    required: boolean;
    min_length?: number;
  }>;
  supported_events: string[];
}

interface MCPConfiguratorProps {
  agentId: string;
  /** Tool ID — only set in edit mode. Required for the "Regenerate" button. */
  toolId?: string;
  config: MCPConfig;
  onChange: (patch: Partial<MCPConfig>) => void;
  onConnectionError?: (msg: string) => void;
  onSecretRegenerated?: (newSecret: string) => void;
}

export default function MCPConfigurator({
  agentId,
  toolId,
  config,
  onChange,
  onConnectionError,
  onSecretRegenerated,
}: MCPConfiguratorProps) {
  const { t, language } = useTranslation();

  const [testing, setTesting] = useState(false);
  // Whether we have live data from the MCP server (vs. only saved names)
  const [liveTested, setLiveTested] = useState(false);
  const [availableTools, setAvailableTools] = useState<MCPToolInfo[]>([]);
  const [showTools, setShowTools] = useState(true);

  const [lastTestedUrl, setLastTestedUrl] = useState('');
  const urlChanged = liveTested && config.server_url !== lastTestedUrl;

  // In edit mode: we have selected_tools from the saved config but no live tool list.
  // Synthesise display items so the user can see what's saved without forcing a reconnect.
  const isEditMode = !liveTested && config.selected_tools.length > 0 && config.server_url !== '';

  // Live-tested tools take priority; fall back to synthetic items from saved selection
  const displayTools: MCPToolInfo[] =
    availableTools.length > 0
      ? availableTools
      : config.selected_tools.map((name) => ({ name, description: '', inputSchema: {} }));

  const showToolsSection =
    (liveTested && !urlChanged && displayTools.length > 0) ||
    isEditMode;

  // Auto-open tool list in edit mode
  useEffect(() => {
    if (isEditMode) setShowTools(true);
  }, [isEditMode]);

  // Header value visibility — per-row, default hidden
  const [revealedHeaders, setRevealedHeaders] = useState<Record<number, boolean>>({});
  const [regenerating, setRegenerating] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);

  // Provider profiles state
  const [providersList, setProvidersList] = useState<MCPProviderProfile[]>([]);
  const [providersLoaded, setProvidersLoaded] = useState(false);
  const [detectedProvider, setDetectedProvider] = useState<MCPProviderProfile | null>(null);
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [isResolvingProvider, setIsResolvingProvider] = useState(false);
  void isResolvingProvider;

  // Mount: fetch all active providers; if config already has a providerId
  // (edit mode), hydrate detectedProvider from the freshly-fetched list.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<{ providers: MCPProviderProfile[] }>(
          `/api/agents/${agentId}/tools/mcp/providers`
        );
        if (cancelled) return;
        setProvidersList(data.providers ?? []);
        if (config.providerId) {
          const match = (data.providers ?? []).find((p) => p.id === config.providerId);
          if (match) setDetectedProvider(match);
        }
      } catch {
        // Silent — empty state still works without providers list
      } finally {
        if (!cancelled) setProvidersLoaded(true);
      }
    })();
    return () => { cancelled = true; };
    // Intentionally only on mount + agentId. config.providerId hydration is one-shot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  // Debounced URL detection. Skip in advanced mode and when URL is too short.
  const detectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isAdvancedMode) return;
    const url = config.server_url.trim();
    if (url.length < 8) {
      if (detectedProvider) setDetectedProvider(null);
      return;
    }
    // Already locked-in to a provider whose default URL matches: keep it.
    if (
      detectedProvider &&
      detectedProvider.default_server_url &&
      url.startsWith(detectedProvider.default_server_url)
    ) {
      return;
    }

    if (detectionTimeoutRef.current) clearTimeout(detectionTimeoutRef.current);
    detectionTimeoutRef.current = setTimeout(async () => {
      setIsResolvingProvider(true);
      try {
        const data = await api.get<{ profile: MCPProviderProfile | null }>(
          `/api/agents/${agentId}/tools/mcp/resolve-profile?url=${encodeURIComponent(url)}`
        );
        if (data.profile) {
          setDetectedProvider(data.profile);
          if (config.providerId !== data.profile.id) {
            onChange({ providerId: data.profile.id });
          }
        } else {
          setDetectedProvider(null);
          if (config.providerId) {
            onChange({ providerId: undefined });
          }
        }
      } catch {
        // Silent — fall back to advanced UI
      } finally {
        setIsResolvingProvider(false);
      }
    }, 500);

    return () => {
      if (detectionTimeoutRef.current) clearTimeout(detectionTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.server_url, isAdvancedMode]);

  function handleSelectProvider(profile: MCPProviderProfile) {
    setDetectedProvider(profile);
    setIsAdvancedMode(false);
    onChange({
      server_url: profile.default_server_url ?? '',
      transport: profile.default_transport,
      providerId: profile.id,
      // Use the profile id as the server name so tool prefixes
      // (mcp_<serverName>_<toolName>) are stable across renames.
      name: config.name && config.name !== 'mcp' ? config.name : profile.id,
      // Preserve any user-typed headers that map to this provider's
      // configurable keys; drop the rest.
      headers: profile.user_configurable_headers.map((h) => {
        const existing = config.headers.find((eh) => eh.key === h.key);
        return existing ?? { key: h.key, value: '' };
      }),
    });
  }

  function handleBackToProviders() {
    setDetectedProvider(null);
    setIsAdvancedMode(false);
    onChange({
      server_url: '',
      transport: 'sse',
      providerId: undefined,
      headers: [],
      selected_tools: [],
      name: '',
    });
  }

  function handleEnterAdvancedMode() {
    if (!confirm(t('agents.tools.mcp.provider.advancedModeConfirmBody'))) return;
    setIsAdvancedMode(true);
    setDetectedProvider(null);
    onChange({ providerId: undefined });
  }

  // Find/update the value of a guided header by its key.
  function getGuidedHeaderValue(key: string): string {
    return config.headers.find((h) => h.key === key)?.value ?? '';
  }
  function setGuidedHeaderValue(key: string, value: string) {
    const exists = config.headers.some((h) => h.key === key);
    const next = exists
      ? config.headers.map((h) => (h.key === key ? { ...h, value } : h))
      : [...config.headers, { key, value }];
    onChange({ headers: next });
  }
  const [revealedGuided, setRevealedGuided] = useState<Record<string, boolean>>({});

  async function handleTestConnection() {
    if (!config.server_url.trim()) return;

    setTesting(true);
    try {
      // Send only headers that have both a key and a non-empty value. Empty
      // values in edit mode mean "keep existing encrypted value", which the
      // server can't see — so skip them for the connection test.
      const testHeaders = config.headers.filter(
        (h) => h.key.trim().length > 0 && h.value.length > 0
      );
      const data = await api.post<{
        success: boolean;
        tools?: MCPToolInfo[];
        error?: string;
      }>(`/api/agents/${agentId}/tools/mcp/test-connection`, {
        server_url: config.server_url.trim(),
        transport: config.transport,
        headers: testHeaders,
        ...(config.providerId ? { providerId: config.providerId } : {}),
      });

      if (data.success && data.tools) {
        setAvailableTools(data.tools);
        setLiveTested(true);
        setLastTestedUrl(config.server_url.trim());
        setShowTools(true);
        // Auto-select all tools only when none were previously selected
        if (config.selected_tools.length === 0) {
          onChange({ selected_tools: data.tools.map((tool) => tool.name) });
        }
      } else {
        const errMsg = data.error ?? 'Connection failed';
        onConnectionError?.(errMsg);
        setLiveTested(false);
        setAvailableTools([]);
      }
    } catch (err) {
      const errMsg = err instanceof ApiError ? err.message : 'Connection failed';
      onConnectionError?.(errMsg);
      setLiveTested(false);
      setAvailableTools([]);
    } finally {
      setTesting(false);
    }
  }

  function toggleTool(toolName: string) {
    const current = config.selected_tools;
    const next = current.includes(toolName)
      ? current.filter((n) => n !== toolName)
      : [...current, toolName];
    onChange({ selected_tools: next });
  }

  function selectAll() {
    onChange({ selected_tools: displayTools.map((tool) => tool.name) });
  }

  function deselectAll() {
    onChange({ selected_tools: [] });
  }

  function addHeader() {
    onChange({ headers: [...config.headers, { key: '', value: '' }] });
  }

  function updateHeader(idx: number, patch: Partial<MCPHeader>) {
    const next = config.headers.map((h, i) => (i === idx ? { ...h, ...patch } : h));
    onChange({ headers: next });
  }

  function removeHeader(idx: number) {
    onChange({ headers: config.headers.filter((_, i) => i !== idx) });
    setRevealedHeaders((r) => {
      const next: Record<number, boolean> = {};
      for (const k of Object.keys(r)) {
        const i = Number(k);
        if (i < idx) next[i] = r[i]!;
        else if (i > idx) next[i - 1] = r[i]!;
      }
      return next;
    });
  }

  async function handleCopySecret() {
    if (!config.webhookSecret) return;
    try {
      await navigator.clipboard.writeText(config.webhookSecret);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    } catch {
      // Clipboard may be denied; ignore silently
    }
  }

  async function handleRegenerateSecret() {
    if (!toolId) return;
    if (!confirm(t('agents.tools.mcp.regenerateConfirm'))) return;
    setRegenerating(true);
    try {
      const data = await api.post<{ webhookSecret: string }>(
        `/api/agents/${agentId}/tools/${toolId}/regenerate-webhook-secret`,
        {}
      );
      onChange({ webhookSecret: data.webhookSecret });
      onSecretRegenerated?.(data.webhookSecret);
    } catch (err) {
      onConnectionError?.(err instanceof ApiError ? err.message : 'Failed to regenerate webhook secret');
    } finally {
      setRegenerating(false);
    }
  }

  const canTest = config.server_url.trim().length > 0 && !testing;
  const selectedCount = config.selected_tools.length;

  // Top-level UI mode:
  // 1. Empty-state catalog: no URL, no detected provider, not in advanced mode
  // 2. Guided UI: provider detected/selected, not in advanced mode
  // 3. Full advanced UI: user opted in OR no provider matches their URL
  const showEmptyState =
    !isAdvancedMode &&
    !detectedProvider &&
    config.server_url.trim() === '' &&
    config.selected_tools.length === 0 &&
    !config.providerId;

  const showGuidedUI = !isAdvancedMode && detectedProvider !== null;

  if (showEmptyState) {
    return (
      <div className={styles.root}>
        <div className={styles.emptyState}>
          <h3 className={styles.emptyStateTitle}>
            {t('agents.tools.mcp.provider.emptyStateTitle')}
          </h3>
          <p className={styles.emptyStateSubtitle}>
            {t('agents.tools.mcp.provider.emptyStateSubtitle')}
          </p>

          {!providersLoaded && (
            <div className={styles.providersLoading}>
              <Spinner size="sm" />
              <span>{t('agents.tools.mcp.provider.loadingProviders')}</span>
            </div>
          )}

          {providersLoaded && providersList.length > 0 && (
            <div className={styles.providersGrid}>
              {providersList.map((profile) => (
                <button
                  type="button"
                  key={profile.id}
                  className={styles.providerCard}
                  onClick={() => handleSelectProvider(profile)}
                >
                  <ProviderLogoPlaceholder
                    id={profile.id}
                    name={profile.name}
                    logoUrl={profile.logo_url}
                    size={48}
                  />
                  <div className={styles.providerCardInfo}>
                    <span className={styles.providerCardName}>{profile.name}</span>
                    {profile.description && (
                      <span className={styles.providerCardDesc}>{profile.description}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            className={styles.urlPersonalizadaLink}
            onClick={() => setIsAdvancedMode(true)}
          >
            <Wrench size={14} />
            <span>{t('agents.tools.mcp.provider.customUrlLink')}</span>
          </button>
        </div>
      </div>
    );
  }

  if (showGuidedUI && detectedProvider) {
    const profile = detectedProvider;
    return (
      <div className={styles.root}>
        {/* Detected banner */}
        <div className={styles.detectedBanner}>
          <ProviderLogoPlaceholder
            id={profile.id}
            name={profile.name}
            logoUrl={profile.logo_url}
            size={36}
          />
          <div className={styles.detectedBannerText}>
            <span className={styles.detectedBannerTitle}>
              {t('agents.tools.mcp.provider.detectedBanner', { name: profile.name })}
            </span>
            {profile.description && (
              <span className={styles.detectedBannerDesc}>{profile.description}</span>
            )}
          </div>
          <Check size={20} className={styles.detectedCheck} />
        </div>

        {/* Back to providers */}
        <button
          type="button"
          className={styles.linkBtn}
          onClick={handleBackToProviders}
          style={{ alignSelf: 'flex-start' }}
        >
          <ArrowLeft size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          {t('agents.tools.mcp.provider.backToProviders')}
        </button>

        {/* URL field readonly */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>{t('agents.tools.mcp.serverUrl')}</label>
          <input
            className={styles.input}
            value={config.server_url}
            readOnly
            style={{ background: 'var(--color-bg-sidebar)', cursor: 'not-allowed' }}
          />
        </div>

        {/* Transport readonly */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>{t('agents.tools.mcp.transport')}</label>
          <input
            className={styles.input}
            value={profile.default_transport === 'streamable-http' ? t('agents.tools.mcp.transportStreamableHttp') : t('agents.tools.mcp.transportSse')}
            readOnly
            style={{ background: 'var(--color-bg-sidebar)', cursor: 'not-allowed' }}
          />
        </div>

        {/* Guided headers — one per user_configurable_header */}
        <div className={styles.guidedHeadersSection}>
          {profile.user_configurable_headers.map((h) => {
            const value = getGuidedHeaderValue(h.key);
            const label = language === 'es' ? h.label_es : h.label_en;
            const helpText = language === 'es' ? h.help_text_es : h.help_text_en;
            const showError =
              h.required && value !== '' && h.min_length && value.length < h.min_length;
            return (
              <div className={styles.guidedHeaderRow} key={h.key}>
                <label className={styles.label}>
                  {label}
                  {h.required && <span style={{ color: 'var(--color-danger)' }}> *</span>}
                </label>
                <div className={styles.urlRow}>
                  <input
                    className={styles.input}
                    type={revealedGuided[h.key] ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => setGuidedHeaderValue(h.key, e.target.value)}
                    placeholder={h.required ? '••••••••' : ''}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className={styles.headerToggleBtn}
                    onClick={() =>
                      setRevealedGuided((r) => ({ ...r, [h.key]: !r[h.key] }))
                    }
                    title={revealedGuided[h.key] ? t('agents.tools.mcp.headerHide') : t('agents.tools.mcp.headerShow')}
                  >
                    {revealedGuided[h.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {h.help_url && (
                  <a
                    href={h.help_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.helpLink}
                  >
                    {t('agents.tools.mcp.provider.howToGetKey')}
                  </a>
                )}
                {helpText && <span className={styles.helpText}>{helpText}</span>}
                {showError && (
                  <span className={styles.helpText} style={{ color: 'var(--color-danger)' }}>
                    {t('agents.tools.mcp.provider.minLengthError', {
                      label,
                      min: String(h.min_length ?? 0),
                    })}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Webhook secret + tools section reused from advanced UI */}
        {(config.webhookSecret || toolId) && (
          <>
            {config.webhookSecret ? (
              <div className={styles.fieldGroup}>
                <label className={styles.label}>{t('agents.tools.mcp.webhookSecret')}</label>
                <div className={styles.secretRow}>
                  <input
                    className={styles.secretInput}
                    type="text"
                    value={config.webhookSecret}
                    readOnly
                  />
                  <button
                    type="button"
                    className={styles.copyBtn}
                    onClick={handleCopySecret}
                    title={t('agents.tools.mcp.headerCopy')}
                  >
                    <Copy size={14} />
                    <span>{secretCopied ? t('agents.tools.mcp.copied') : t('agents.tools.mcp.headerCopy')}</span>
                  </button>
                  {toolId && (
                    <button
                      type="button"
                      className={styles.regenBtn}
                      onClick={handleRegenerateSecret}
                      disabled={regenerating}
                    >
                      {regenerating ? <Spinner size="sm" /> : <RefreshCw size={14} />}
                      <span>{t('agents.tools.mcp.regenerate')}</span>
                    </button>
                  )}
                </div>
                <p className={styles.fieldHint}>{t('agents.tools.mcp.webhookSecretHint')}</p>
              </div>
            ) : null}
          </>
        )}

        {/* Test connection + tools list */}
        <div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleTestConnection}
            disabled={!canTest}
          >
            {testing ? (
              <>
                <Spinner size="sm" />
                <span>{t('agents.tools.mcp.testing')}</span>
              </>
            ) : (
              t('agents.tools.mcp.testConnection')
            )}
          </Button>
          {liveTested && !urlChanged && (
            <div className={styles.statusOk}>
              <Check size={14} />
              <span>
                {t('agents.tools.mcp.connectionSuccess', { count: String(availableTools.length) })}
              </span>
            </div>
          )}
        </div>

        {showToolsSection && (
          <div className={styles.toolsSection}>
            <button
              type="button"
              className={styles.toolsToggle}
              onClick={() => setShowTools((s) => !s)}
            >
              <Plug size={14} />
              <span>
                {t('agents.tools.mcp.availableTools')}{' '}
                <span className={styles.toolsBadge}>
                  {t('agents.tools.mcp.selectedTools', { count: String(selectedCount) })}
                  {displayTools.length > 0 && ` / ${displayTools.length}`}
                </span>
              </span>
              {showTools ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showTools && (
              <div className={styles.toolsList}>
                <div className={styles.toolsActions}>
                  <button type="button" className={styles.linkBtn} onClick={selectAll}>
                    {t('agents.tools.mcp.selectAll')}
                  </button>
                  <span className={styles.dot}>·</span>
                  <button type="button" className={styles.linkBtn} onClick={deselectAll}>
                    {t('agents.tools.mcp.deselectAll')}
                  </button>
                </div>
                {displayTools.map((tool) => (
                  <label key={tool.name} className={styles.toolItem}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={config.selected_tools.includes(tool.name)}
                      onChange={() => toggleTool(tool.name)}
                    />
                    <div className={styles.toolInfo}>
                      <span className={styles.toolName}>{tool.name}</span>
                      {tool.description && (
                        <span className={styles.toolDesc}>{tool.description}</span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {(liveTested || isEditMode) && !urlChanged && selectedCount === 0 && (
          <p className={styles.hint}>{t('agents.tools.mcp.noToolsSelected')}</p>
        )}

        {/* Advanced mode escape hatch */}
        <button
          type="button"
          className={styles.advancedModeLink}
          onClick={handleEnterAdvancedMode}
        >
          <Wrench size={12} />
          <span>{t('agents.tools.mcp.provider.advancedModeLink')}</span>
        </button>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {/* Server URL */}
      <div className={styles.fieldGroup}>
        <label className={styles.label}>
          {t('agents.tools.mcp.serverUrl')}
        </label>
        <div className={styles.urlRow}>
          <input
            className={styles.input}
            value={config.server_url}
            onChange={(e) => {
              onChange({ server_url: e.target.value });
              if (liveTested) {
                setLiveTested(false);
                setAvailableTools([]);
              }
            }}
            placeholder={t('agents.tools.mcp.serverUrlPlaceholder')}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={handleTestConnection}
            disabled={!canTest}
          >
            {testing ? (
              <>
                <Spinner size="sm" />
                <span>{t('agents.tools.mcp.testing')}</span>
              </>
            ) : (
              t('agents.tools.mcp.testConnection')
            )}
          </Button>
        </div>

        {/* Connection status — live test */}
        {liveTested && !urlChanged && (
          <div className={styles.statusOk}>
            <Check size={14} />
            <span>
              {t('agents.tools.mcp.connectionSuccess', {
                count: String(availableTools.length),
              })}
            </span>
          </div>
        )}

        {/* Edit mode banner — saved tools, not yet re-tested */}
        {isEditMode && (
          <div className={styles.statusInfo}>
            <Info size={14} />
            <span>
              {selectedCount} {selectedCount === 1 ? 'tool' : 'tools'} saved.{' '}
              {t('agents.tools.mcp.testConnection')} to refresh the list.
            </span>
          </div>
        )}

        {urlChanged && (
          <div className={styles.statusWarn}>
            <X size={14} />
            <span>{t('agents.tools.mcp.retestNeeded')}</span>
          </div>
        )}
      </div>

      {/* Server Name */}
      <div className={styles.fieldGroup}>
        <label className={styles.label}>
          {t('agents.tools.mcp.serverName')}
        </label>
        <input
          className={styles.input}
          value={config.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={t('agents.tools.mcp.serverNamePlaceholder')}
        />
      </div>

      {/* Transport */}
      <div className={styles.fieldGroup}>
        <label className={styles.label}>
          {t('agents.tools.mcp.transport')}
        </label>
        <select
          className={styles.select}
          value={config.transport}
          onChange={(e) =>
            onChange({ transport: e.target.value as MCPConfig['transport'] })
          }
        >
          <option value="sse">{t('agents.tools.mcp.transportSse')}</option>
          <option value="streamable-http">{t('agents.tools.mcp.transportStreamableHttp')}</option>
        </select>
        <span className={styles.fieldHint}>
          {t('agents.tools.mcp.transportHint')}
        </span>
      </div>

      {/* Webhook Secret — only visible after creation or regeneration. Plain
          text is shown ONCE; subsequent reads from the server return nothing
          (it's stored encrypted). */}
      {config.webhookSecret && (
        <div className={styles.fieldGroup}>
          <label className={styles.label}>{t('agents.tools.mcp.webhookSecret')}</label>
          <div className={styles.secretRow}>
            <input
              className={styles.secretInput}
              type="text"
              value={config.webhookSecret}
              readOnly
            />
            <button
              type="button"
              className={styles.copyBtn}
              onClick={handleCopySecret}
              title={t('agents.tools.mcp.headerCopy')}
            >
              <Copy size={14} />
              <span>{secretCopied ? t('agents.tools.mcp.copied') : t('agents.tools.mcp.headerCopy')}</span>
            </button>
            {toolId && (
              <button
                type="button"
                className={styles.regenBtn}
                onClick={handleRegenerateSecret}
                disabled={regenerating}
                title={t('agents.tools.mcp.regenerate')}
              >
                {regenerating ? <Spinner size="sm" /> : <RefreshCw size={14} />}
                <span>{t('agents.tools.mcp.regenerate')}</span>
              </button>
            )}
          </div>
          <p className={styles.fieldHint}>{t('agents.tools.mcp.webhookSecretHint')}</p>
        </div>
      )}

      {/* In edit mode without a freshly-shown secret: still expose the
          regenerate button so the user can rotate. */}
      {!config.webhookSecret && toolId && (
        <div className={styles.fieldGroup}>
          <label className={styles.label}>{t('agents.tools.mcp.webhookSecret')}</label>
          <div className={styles.secretRow}>
            <input
              className={styles.secretInput}
              type="text"
              value="••••••••••••••••••••••••••••••••"
              readOnly
            />
            <button
              type="button"
              className={styles.regenBtn}
              onClick={handleRegenerateSecret}
              disabled={regenerating}
              title={t('agents.tools.mcp.regenerate')}
            >
              {regenerating ? <Spinner size="sm" /> : <RefreshCw size={14} />}
              <span>{t('agents.tools.mcp.regenerate')}</span>
            </button>
          </div>
          <p className={styles.fieldHint}>{t('agents.tools.mcp.webhookSecretRotateHint')}</p>
        </div>
      )}

      {/* Custom Headers */}
      <div className={styles.fieldGroup}>
        <div className={styles.headersHeader}>
          <label className={styles.label}>{t('agents.tools.mcp.customHeaders')}</label>
          <button
            type="button"
            className={styles.addHeaderBtn}
            onClick={addHeader}
          >
            <Plus size={14} /> {t('agents.tools.mcp.addHeader')}
          </button>
        </div>

        {config.headers.length === 0 && (
          <p className={styles.headersEmpty}>{t('agents.tools.mcp.noHeadersYet')}</p>
        )}

        {config.headers.map((header, idx) => (
          <div key={idx} className={styles.headerRow}>
            <input
              className={styles.headerKey}
              placeholder={t('agents.tools.mcp.headerKeyPlaceholder')}
              value={header.key}
              onChange={(e) => updateHeader(idx, { key: e.target.value })}
            />
            <input
              className={styles.headerValue}
              type={revealedHeaders[idx] ? 'text' : 'password'}
              placeholder={t('agents.tools.mcp.headerValuePlaceholder')}
              value={header.value}
              onChange={(e) => updateHeader(idx, { value: e.target.value })}
            />
            <button
              type="button"
              className={styles.headerToggleBtn}
              onClick={() => setRevealedHeaders((r) => ({ ...r, [idx]: !r[idx] }))}
              title={revealedHeaders[idx] ? t('agents.tools.mcp.headerHide') : t('agents.tools.mcp.headerShow')}
            >
              {revealedHeaders[idx] ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button
              type="button"
              className={styles.headerRemoveBtn}
              onClick={() => removeHeader(idx)}
              title={t('agents.tools.mcp.headerRemove')}
            >
              <X size={14} />
            </button>
          </div>
        ))}

        <p className={styles.fieldHint}>{t('agents.tools.mcp.headersHint')}</p>
      </div>

      {/* Tools list — shown after live test OR in edit mode with saved tools */}
      {showToolsSection && (
        <div className={styles.toolsSection}>
          <button
            type="button"
            className={styles.toolsToggle}
            onClick={() => setShowTools((s) => !s)}
          >
            <Plug size={14} />
            <span>
              {t('agents.tools.mcp.availableTools')}
              {' '}
              <span className={styles.toolsBadge}>
                {t('agents.tools.mcp.selectedTools', {
                  count: String(selectedCount),
                })}
                {displayTools.length > 0 && ` / ${displayTools.length}`}
              </span>
            </span>
            {showTools ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showTools && (
            <div className={styles.toolsList}>
              <div className={styles.toolsActions}>
                <button type="button" className={styles.linkBtn} onClick={selectAll}>
                  {t('agents.tools.mcp.selectAll')}
                </button>
                <span className={styles.dot}>·</span>
                <button type="button" className={styles.linkBtn} onClick={deselectAll}>
                  {t('agents.tools.mcp.deselectAll')}
                </button>
              </div>
              {displayTools.map((tool) => (
                <label key={tool.name} className={styles.toolItem}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={config.selected_tools.includes(tool.name)}
                    onChange={() => toggleTool(tool.name)}
                  />
                  <div className={styles.toolInfo}>
                    <span className={styles.toolName}>{tool.name}</span>
                    {tool.description && (
                      <span className={styles.toolDesc}>{tool.description}</span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Validation hint */}
      {(liveTested || isEditMode) && !urlChanged && selectedCount === 0 && (
        <p className={styles.hint}>{t('agents.tools.mcp.noToolsSelected')}</p>
      )}
    </div>
  );
}
