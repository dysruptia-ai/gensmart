'use client';

import React, { useState, useEffect } from 'react';
import { Plug, Check, X, ChevronDown, ChevronUp, Info } from 'lucide-react';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { api, ApiError } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './MCPConfigurator.module.css';

export interface MCPToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPConfig {
  server_url: string;
  name: string;
  transport: 'sse' | 'streamable-http';
  selected_tools: string[];
}

interface MCPConfiguratorProps {
  agentId: string;
  config: MCPConfig;
  onChange: (patch: Partial<MCPConfig>) => void;
  onConnectionError?: (msg: string) => void;
}

export default function MCPConfigurator({
  agentId,
  config,
  onChange,
  onConnectionError,
}: MCPConfiguratorProps) {
  const { t } = useTranslation();

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

  async function handleTestConnection() {
    if (!config.server_url.trim()) return;

    setTesting(true);
    try {
      const data = await api.post<{
        success: boolean;
        tools?: MCPToolInfo[];
        error?: string;
      }>(`/api/agents/${agentId}/tools/mcp/test-connection`, {
        server_url: config.server_url.trim(),
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

  const canTest = config.server_url.trim().length > 0 && !testing;
  const selectedCount = config.selected_tools.length;

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
