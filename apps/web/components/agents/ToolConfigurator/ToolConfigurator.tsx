'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Calendar, Database, Code2, Globe2, Wrench, Trash2, Settings, Upload, X,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Toggle from '@/components/ui/Toggle';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { api, ApiError } from '@/lib/api';
import styles from './ToolConfigurator.module.css';

// ── Types ────────────────────────────────────────────────────────────────────

type ToolType = 'scheduling' | 'rag' | 'web_scraping' | 'custom_function' | 'mcp';

interface AgentTool {
  id: string;
  type: ToolType;
  name: string;
  description?: string;
  config: Record<string, unknown>;
  isEnabled: boolean;
}

interface Param {
  name: string;
  type: string;
  required: boolean;
}

interface ToolForm {
  name: string;
  description: string;
  type: ToolType;
  // scheduling
  schedulingType: string;
  timezone: string;
  // rag
  collectionName: string;
  files: File[];
  // custom_function
  endpointUrl: string;
  httpMethod: string;
  params: Param[];
  // mcp
  mcpServerUrl: string;
  mcpServerName: string;
  mcpApiKey: string;
  // web_scraping
  allowedDomains: string;
}

const DEFAULT_FORM: ToolForm = {
  name: '',
  description: '',
  type: 'custom_function',
  schedulingType: 'appointment',
  timezone: 'UTC',
  collectionName: '',
  files: [],
  endpointUrl: '',
  httpMethod: 'POST',
  params: [],
  mcpServerUrl: '',
  mcpServerName: '',
  mcpApiKey: '',
  allowedDomains: '',
};

// ── Catalog entries ───────────────────────────────────────────────────────────

const TOOL_CATALOG: { type: ToolType; label: string; icon: React.ElementType; desc: string }[] = [
  { type: 'custom_function', label: 'Custom Function', icon: Code2, desc: 'Call any HTTP endpoint' },
  { type: 'scheduling', label: 'Scheduling', icon: Calendar, desc: 'Appointment / reminder booking' },
  { type: 'rag', label: 'Knowledge Base', icon: Database, desc: 'Upload docs for retrieval' },
  { type: 'web_scraping', label: 'Web Scraping', icon: Globe2, desc: 'Fetch content from URLs' },
  { type: 'mcp', label: 'MCP Server', icon: Wrench, desc: 'Model Context Protocol server' },
];

const TOOL_ICONS: Record<ToolType, React.ElementType> = {
  custom_function: Code2,
  scheduling: Calendar,
  rag: Database,
  web_scraping: Globe2,
  mcp: Wrench,
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildConfig(form: ToolForm): Record<string, unknown> {
  switch (form.type) {
    case 'scheduling':
      return { schedulingType: form.schedulingType, timezone: form.timezone };
    case 'rag':
      return { collectionName: form.collectionName };
    case 'custom_function':
      return {
        endpointUrl: form.endpointUrl,
        httpMethod: form.httpMethod,
        params: form.params,
      };
    case 'mcp':
      return {
        serverUrl: form.mcpServerUrl,
        serverName: form.mcpServerName,
        apiKey: form.mcpApiKey,
      };
    case 'web_scraping':
      return {
        allowedDomains: form.allowedDomains
          .split(',')
          .map((d) => d.trim())
          .filter(Boolean),
      };
    default:
      return {};
  }
}

// ── Main Component ────────────────────────────────────────────────────────────

interface ToolConfiguratorProps {
  agentId: string;
}

export default function ToolConfigurator({ agentId }: ToolConfiguratorProps) {
  const { success, error: toastError } = useToast();
  const [tools, setTools] = useState<AgentTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTool, setEditTool] = useState<AgentTool | null>(null);
  const [form, setForm] = useState<ToolForm>(DEFAULT_FORM);
  const [activeType, setActiveType] = useState<ToolType>('custom_function');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadTools = useCallback(async () => {
    try {
      const data = await api.get<{ tools: AgentTool[] }>(`/api/agents/${agentId}/tools`);
      setTools(data.tools);
    } catch {
      // non-critical on mount
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => { loadTools(); }, [loadTools]);

  function openAdd() {
    setForm({ ...DEFAULT_FORM });
    setActiveType('custom_function');
    setEditTool(null);
    setShowAddModal(true);
  }

  function openEdit(tool: AgentTool) {
    const cfg = tool.config;
    setEditTool(tool);
    setActiveType(tool.type);
    setForm({
      ...DEFAULT_FORM,
      name: tool.name,
      description: tool.description ?? '',
      type: tool.type,
      schedulingType: (cfg['schedulingType'] as string) ?? 'appointment',
      timezone: (cfg['timezone'] as string) ?? 'UTC',
      collectionName: (cfg['collectionName'] as string) ?? '',
      endpointUrl: (cfg['endpointUrl'] as string) ?? '',
      httpMethod: (cfg['httpMethod'] as string) ?? 'POST',
      params: (cfg['params'] as Param[]) ?? [],
      mcpServerUrl: (cfg['serverUrl'] as string) ?? '',
      mcpServerName: (cfg['serverName'] as string) ?? '',
      mcpApiKey: (cfg['apiKey'] as string) ?? '',
      allowedDomains: Array.isArray(cfg['allowedDomains'])
        ? (cfg['allowedDomains'] as string[]).join(', ')
        : '',
    });
    setShowAddModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toastError('Tool name is required');
      return;
    }
    setSaving(true);
    try {
      if (editTool) {
        const updated = await api.put<{ tool: AgentTool }>(
          `/api/agents/${agentId}/tools/${editTool.id}`,
          { name: form.name, description: form.description, config: buildConfig(form) }
        );
        setTools((prev) => prev.map((t) => (t.id === editTool.id ? updated.tool : t)));
        success('Tool updated');
      } else {
        const created = await api.post<{ tool: AgentTool }>(
          `/api/agents/${agentId}/tools`,
          { type: form.type, name: form.name, description: form.description, config: buildConfig(form) }
        );
        setTools((prev) => [...prev, created.tool]);
        success('Tool added');
      }
      setShowAddModal(false);
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Failed to save tool');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(tool: AgentTool) {
    const next = !tool.isEnabled;
    setTools((prev) => prev.map((t) => (t.id === tool.id ? { ...t, isEnabled: next } : t)));
    try {
      await api.put(`/api/agents/${agentId}/tools/${tool.id}`, { isEnabled: next });
    } catch {
      // revert
      setTools((prev) => prev.map((t) => (t.id === tool.id ? { ...t, isEnabled: !next } : t)));
      toastError('Failed to update tool');
    }
  }

  async function handleDelete(tool: AgentTool) {
    try {
      await api.delete(`/api/agents/${agentId}/tools/${tool.id}`);
      setTools((prev) => prev.filter((t) => t.id !== tool.id));
      success('Tool removed');
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Failed to delete tool');
    }
  }

  function setField<K extends keyof ToolForm>(key: K, value: ToolForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addParam() {
    setField('params', [...form.params, { name: '', type: 'string', required: false }]);
  }

  function updateParam(idx: number, patch: Partial<Param>) {
    setField('params', form.params.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }

  function removeParam(idx: number) {
    setField('params', form.params.filter((_, i) => i !== idx));
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const newFiles = Array.from(fileList);
    setField('files', [...form.files, ...newFiles]);
  }

  // ── Tool type config panels ────────────────────────────────────────────────

  function renderConfigPanel() {
    switch (activeType) {
      case 'custom_function':
        return (
          <>
            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Endpoint URL</label>
                <input
                  className={styles.fieldInput}
                  value={form.endpointUrl}
                  onChange={(e) => setField('endpointUrl', e.target.value)}
                  placeholder="https://api.example.com/endpoint"
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>HTTP Method</label>
                <select
                  className={styles.fieldSelect}
                  value={form.httpMethod}
                  onChange={(e) => setField('httpMethod', e.target.value)}
                >
                  <option>POST</option>
                  <option>GET</option>
                  <option>PUT</option>
                  <option>PATCH</option>
                </select>
              </div>
            </div>
            <div className={styles.fieldGroup}>
              <div className={styles.paramsHeader}>
                <label className={styles.fieldLabel}>Parameters</label>
              </div>
              <div className={styles.paramsList}>
                {form.params.map((p, i) => (
                  <div key={i} className={styles.paramRow}>
                    <input
                      className={styles.fieldInput}
                      value={p.name}
                      onChange={(e) => updateParam(i, { name: e.target.value })}
                      placeholder="param_name"
                    />
                    <select
                      className={styles.fieldSelect}
                      value={p.type}
                      onChange={(e) => updateParam(i, { type: e.target.value })}
                    >
                      <option>string</option>
                      <option>number</option>
                      <option>boolean</option>
                    </select>
                    <button className={styles.iconBtn} onClick={() => removeParam(i)} aria-label="Remove param">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button className={styles.addParamBtn} onClick={addParam}>
                <Plus size={12} /> Add Parameter
              </button>
            </div>
          </>
        );

      case 'scheduling':
        return (
          <>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Scheduling Type</label>
              <select
                className={styles.fieldSelect}
                value={form.schedulingType}
                onChange={(e) => setField('schedulingType', e.target.value)}
              >
                <option value="appointment">Appointment Booking</option>
                <option value="reminder">Reminder</option>
                <option value="follow_up">Follow-up</option>
              </select>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Timezone</label>
              <input
                className={styles.fieldInput}
                value={form.timezone}
                onChange={(e) => setField('timezone', e.target.value)}
                placeholder="UTC"
              />
              <span className={styles.fieldHint}>e.g. America/New_York, Europe/Madrid</span>
            </div>
          </>
        );

      case 'rag':
        return (
          <>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Collection Name</label>
              <input
                className={styles.fieldInput}
                value={form.collectionName}
                onChange={(e) => setField('collectionName', e.target.value)}
                placeholder="my-knowledge-base"
              />
              <span className={styles.fieldHint}>A unique name for this knowledge base</span>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Documents</label>
              <div
                className={styles.uploadZone}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
              >
                <Upload size={20} style={{ color: 'var(--color-text-secondary)' }} aria-hidden="true" />
                <span className={styles.uploadZoneText}>Click or drag files here</span>
                <span className={styles.uploadZoneHint}>PDF, DOCX, TXT — max 20MB each</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className={styles.fileInput}
                multiple
                accept=".pdf,.docx,.txt,.md"
                onChange={(e) => handleFiles(e.target.files)}
              />
              {form.files.length > 0 && (
                <div className={styles.fileList}>
                  {form.files.map((f, i) => (
                    <div key={i} className={styles.fileRow}>
                      <span className={styles.fileName}>{f.name}</span>
                      <span className={styles.fileSize}>{formatBytes(f.size)}</span>
                      <button
                        className={[styles.iconBtn, styles.iconBtnDanger].join(' ')}
                        onClick={() => setField('files', form.files.filter((_, fi) => fi !== i))}
                        aria-label={`Remove ${f.name}`}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        );

      case 'mcp':
        return (
          <>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Server URL</label>
              <input
                className={styles.fieldInput}
                value={form.mcpServerUrl}
                onChange={(e) => setField('mcpServerUrl', e.target.value)}
                placeholder="https://mcp.example.com"
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Server Name</label>
              <input
                className={styles.fieldInput}
                value={form.mcpServerName}
                onChange={(e) => setField('mcpServerName', e.target.value)}
                placeholder="my-mcp-server"
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>API Key</label>
              <input
                className={styles.fieldInput}
                type="password"
                value={form.mcpApiKey}
                onChange={(e) => setField('mcpApiKey', e.target.value)}
                placeholder="sk-..."
              />
            </div>
          </>
        );

      case 'web_scraping':
        return (
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Allowed Domains</label>
            <textarea
              className={styles.fieldTextarea}
              value={form.allowedDomains}
              onChange={(e) => setField('allowedDomains', e.target.value)}
              placeholder="example.com, docs.example.com"
            />
            <span className={styles.fieldHint}>Comma-separated list of domains the agent may scrape</span>
          </div>
        );

      default:
        return null;
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
        <Spinner size="md" />
      </div>
    );
  }

  const catalogEntry = TOOL_CATALOG.find((c) => c.type === activeType);

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <span className={styles.toolbarTitle}>Tools ({tools.length})</span>
        <Button variant="secondary" size="sm" icon={Plus} onClick={openAdd}>
          Add Tool
        </Button>
      </div>

      {tools.length === 0 ? (
        <div className={styles.emptyState}>
          <Wrench size={28} strokeWidth={1.5} aria-hidden="true" />
          <p className={styles.emptyTitle}>No tools configured</p>
          <p className={styles.emptyDesc}>
            Add tools to extend your agent with scheduling, knowledge bases, custom API calls, and more.
          </p>
          <Button size="sm" icon={Plus} onClick={openAdd}>Add First Tool</Button>
        </div>
      ) : (
        <div className={styles.toolList}>
          {tools.map((tool) => {
            const Icon = TOOL_ICONS[tool.type] ?? Wrench;
            return (
              <div key={tool.id} className={styles.toolRow}>
                <Icon size={18} className={styles.toolIcon} aria-hidden="true" />
                <div className={styles.toolInfo}>
                  <span className={styles.toolName}>{tool.name}</span>
                  {tool.description && (
                    <span className={styles.toolDesc}>{tool.description}</span>
                  )}
                </div>
                <div className={styles.toolActions}>
                  <Toggle checked={tool.isEnabled} onChange={() => handleToggle(tool)} />
                  <button
                    className={styles.iconBtn}
                    onClick={() => openEdit(tool)}
                    aria-label={`Edit ${tool.name}`}
                  >
                    <Settings size={15} />
                  </button>
                  <button
                    className={[styles.iconBtn, styles.iconBtnDanger].join(' ')}
                    onClick={() => handleDelete(tool)}
                    aria-label={`Delete ${tool.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Tool Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={editTool ? 'Edit Tool' : 'Add Tool'}
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Two-panel layout: catalog sidebar + config panel */}
          <div className={styles.modalLayout}>
            {/* Catalog */}
            <div className={styles.catalog}>
              <span className={styles.catalogLabel}>Tool Type</span>
              {TOOL_CATALOG.map((cat) => {
                const CatIcon = cat.icon;
                return (
                  <button
                    key={cat.type}
                    className={[styles.catalogBtn, activeType === cat.type ? styles.catalogBtnActive : '']
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => { setActiveType(cat.type); setField('type', cat.type); }}
                    disabled={!!editTool}
                  >
                    <CatIcon size={15} className={styles.catalogBtnIcon} aria-hidden="true" />
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Config panel */}
            <div className={styles.configPanel}>
              <div className={styles.configHeading}>
                <span className={styles.configTitle}>{catalogEntry?.label ?? 'Tool'}</span>
                <span className={styles.configDesc}>{catalogEntry?.desc}</span>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Tool Name</label>
                <input
                  className={styles.fieldInput}
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder={`My ${catalogEntry?.label ?? 'Tool'}`}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Description</label>
                <input
                  className={styles.fieldInput}
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  placeholder="What does this tool do?"
                />
              </div>

              {renderConfigPanel()}
            </div>
          </div>

          {/* Footer */}
          <div className={styles.modalFooter}>
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>
              {editTool ? 'Save Changes' : 'Add Tool'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
