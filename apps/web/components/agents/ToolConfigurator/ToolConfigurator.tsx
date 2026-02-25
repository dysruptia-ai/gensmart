'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Calendar, Database, Code2, Wrench, Trash2, Settings, Upload, X,
  Check, RefreshCw, ChevronDown, ChevronUp, Play,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Toggle from '@/components/ui/Toggle';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { api, ApiError } from '@/lib/api';
import { PLAN_LIMITS } from '@gensmart/shared';
import styles from './ToolConfigurator.module.css';

// ── Types ────────────────────────────────────────────────────────────────────

// web_scraping kept for backwards compat with existing DB records; not creatable in UI
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

interface HeaderEntry {
  key: string;
  value: string;
}

interface KnowledgeFile {
  id: string;
  filename: string;
  fileType: string;
  sourceUrl: string | null;
  fileSize: number | null;
  status: 'processing' | 'ready' | 'error';
  errorMessage: string | null;
  chunkCount: number;
  createdAt: string;
}

interface Calendar {
  id: string;
  name: string;
}

interface TestResult {
  statusCode: number;
  latencyMs: number;
  body: unknown;
}

interface ToolForm {
  name: string;
  description: string;
  type: ToolType;
  // scheduling
  schedulingType: string;
  timezone: string;
  calendarId: string;
  // rag
  collectionName: string;
  files: File[];
  // custom_function
  endpointUrl: string;
  httpMethod: string;
  params: Param[];
  headers: HeaderEntry[];
  authType: 'none' | 'bearer' | 'api_key_header' | 'api_key_query';
  authToken: string;
  authHeaderName: string;
  authApiKey: string;
  authQueryParam: string;
  bodyTemplate: string;
  responsePathMapping: string;
  responseFormatMapping: string;
  timeoutSeconds: number;
  // mcp
  mcpServerUrl: string;
  mcpServerName: string;
  mcpApiKey: string;
  mcpTransport: 'sse' | 'streamable-http';
  // web_scraping
  allowedDomains: string;
}

const DEFAULT_FORM: ToolForm = {
  name: '',
  description: '',
  type: 'custom_function',
  schedulingType: 'appointment',
  timezone: 'UTC',
  calendarId: '',
  collectionName: '',
  files: [],
  endpointUrl: '',
  httpMethod: 'POST',
  params: [],
  headers: [{ key: 'Content-Type', value: 'application/json' }],
  authType: 'none',
  authToken: '',
  authHeaderName: '',
  authApiKey: '',
  authQueryParam: '',
  bodyTemplate: '',
  responsePathMapping: '',
  responseFormatMapping: '',
  timeoutSeconds: 10,
  mcpServerUrl: '',
  mcpServerName: '',
  mcpApiKey: '',
  mcpTransport: 'sse',
  allowedDomains: '',
};

// ── Catalog entries ───────────────────────────────────────────────────────────

const TOOL_CATALOG: { type: ToolType; label: string; icon: React.ElementType; desc: string }[] = [
  { type: 'custom_function', label: 'Custom Function', icon: Code2, desc: 'Call any HTTP endpoint' },
  { type: 'scheduling', label: 'Scheduling', icon: Calendar, desc: 'Appointment / reminder booking' },
  { type: 'rag', label: 'Knowledge Base', icon: Database, desc: 'Upload docs & web pages for retrieval' },
  { type: 'mcp', label: 'MCP Server', icon: Wrench, desc: 'Model Context Protocol server' },
];

const TOOL_ICONS: Partial<Record<ToolType, React.ElementType>> = {
  custom_function: Code2,
  scheduling: Calendar,
  rag: Database,
  mcp: Wrench,
  // web_scraping: legacy type, falls back to Wrench
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildConfig(form: ToolForm): Record<string, unknown> {
  switch (form.type) {
    case 'scheduling':
      return {
        schedulingType: form.schedulingType,
        timezone: form.timezone,
        calendarId: form.calendarId || undefined,
      };
    case 'rag':
      return {
        collectionName: form.collectionName,
        allowedDomains: form.allowedDomains
          ? form.allowedDomains.split(',').map((d) => d.trim()).filter(Boolean)
          : [],
      };
    case 'custom_function': {
      const headersObj = form.headers.reduce<Record<string, string>>(
        (acc, h) => (h.key ? { ...acc, [h.key]: h.value } : acc),
        {}
      );
      let auth: Record<string, unknown> | undefined;
      if (form.authType !== 'none') {
        auth = { type: form.authType };
        if (form.authType === 'bearer') {
          auth['token'] = form.authToken;
        } else if (form.authType === 'api_key_header') {
          auth['headerName'] = form.authHeaderName;
          auth['apiKey'] = form.authApiKey;
        } else if (form.authType === 'api_key_query') {
          auth['queryParam'] = form.authQueryParam;
          auth['apiKey'] = form.authApiKey;
        }
      }
      let parsedBody: unknown;
      if (form.bodyTemplate) {
        try {
          parsedBody = JSON.parse(form.bodyTemplate);
        } catch {
          parsedBody = form.bodyTemplate;
        }
      }
      return {
        endpointUrl: form.endpointUrl,
        httpMethod: form.httpMethod,
        headers: headersObj,
        auth,
        parameters: form.params,
        params: form.params,
        bodyTemplate: parsedBody,
        responseMapping:
          form.responsePathMapping || form.responseFormatMapping
            ? { path: form.responsePathMapping, format: form.responseFormatMapping }
            : undefined,
        timeoutMs: form.timeoutSeconds * 1000,
      };
    }
    case 'mcp':
      return {
        serverUrl: form.mcpServerUrl,
        serverName: form.mcpServerName,
        apiKey: form.mcpApiKey,
        transport: form.mcpTransport,
      };
    default:
      return {};
  }
}

// ── Main Component ────────────────────────────────────────────────────────────

interface ToolConfiguratorProps {
  agentId: string;
  orgPlan: string;
}

export default function ToolConfigurator({ agentId, orgPlan }: ToolConfiguratorProps) {
  const { success, error: toastError } = useToast();
  const [tools, setTools] = useState<AgentTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTool, setEditTool] = useState<AgentTool | null>(null);
  const [form, setForm] = useState<ToolForm>(DEFAULT_FORM);
  const [activeType, setActiveType] = useState<ToolType>('custom_function');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Knowledge base state
  const [knowledgeFiles, setKnowledgeFiles] = useState<KnowledgeFile[]>([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlAdding, setUrlAdding] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Scheduling calendars
  const [calendars, setCalendars] = useState<Calendar[]>([]);

  // Test panel state
  const [testOpen, setTestOpen] = useState(false);
  const [testInputs, setTestInputs] = useState<Record<string, string>>({});
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  // Plan limits
  const planKey = (orgPlan as keyof typeof PLAN_LIMITS) in PLAN_LIMITS
    ? (orgPlan as keyof typeof PLAN_LIMITS)
    : 'free';
  const limits = PLAN_LIMITS[planKey];
  const canUseCustomFunction = limits.customFunctions > 0;
  const canUseMcp = limits.mcpServers > 0;
  const knowledgeLimit = limits.knowledgeFiles;

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

  // Knowledge files polling
  const loadKnowledgeFiles = useCallback(async () => {
    if (!editTool) return;
    try {
      const data = await api.get<{ files: KnowledgeFile[] }>(
        `/api/agents/${agentId}/knowledge`
      );
      setKnowledgeFiles(data.files);
    } catch {
      // ignore
    }
  }, [agentId, editTool]);

  useEffect(() => {
    if (editTool && activeType === 'rag') {
      setKnowledgeLoading(true);
      loadKnowledgeFiles().finally(() => setKnowledgeLoading(false));
    }
  }, [editTool, activeType, loadKnowledgeFiles]);

  useEffect(() => {
    if (editTool && activeType === 'rag') {
      pollRef.current = setInterval(() => {
        const hasProcessing = knowledgeFiles.some((f) => f.status === 'processing');
        if (hasProcessing) {
          loadKnowledgeFiles();
        }
      }, 5000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [editTool, activeType, knowledgeFiles, loadKnowledgeFiles]);

  // Load calendars when scheduling panel opens
  useEffect(() => {
    if (activeType === 'scheduling') {
      api.get<{ calendars: Calendar[] }>('/api/calendars')
        .then((data) => setCalendars(data.calendars))
        .catch(() => setCalendars([]));
    }
  }, [activeType]);

  function openAdd() {
    setForm({ ...DEFAULT_FORM });
    setActiveType('custom_function');
    setEditTool(null);
    setKnowledgeFiles([]);
    setTestResult(null);
    setTestOpen(false);
    setShowAddModal(true);
  }

  function openEdit(tool: AgentTool) {
    const cfg = tool.config;
    setEditTool(tool);
    setActiveType(tool.type);
    setKnowledgeFiles([]);
    setTestResult(null);
    setTestOpen(false);

    // Parse headers from object to array
    const rawHeaders = cfg['headers'] as Record<string, string> | undefined;
    const parsedHeaders: HeaderEntry[] = rawHeaders
      ? Object.entries(rawHeaders).map(([key, value]) => ({ key, value }))
      : [{ key: 'Content-Type', value: 'application/json' }];

    // Parse auth
    const rawAuth = cfg['auth'] as { type: string; token?: string; headerName?: string; apiKey?: string; queryParam?: string } | undefined;
    const authType = (rawAuth?.type ?? 'none') as ToolForm['authType'];

    // Parse body template
    const rawBodyTemplate = cfg['bodyTemplate'];
    const bodyTemplateStr = rawBodyTemplate
      ? typeof rawBodyTemplate === 'string'
        ? rawBodyTemplate
        : JSON.stringify(rawBodyTemplate, null, 2)
      : '';

    // Parse response mapping
    const rawMapping = cfg['responseMapping'] as { path?: string; format?: string } | undefined;

    setForm({
      ...DEFAULT_FORM,
      name: tool.name,
      description: tool.description ?? '',
      type: tool.type,
      schedulingType: (cfg['schedulingType'] as string) ?? 'appointment',
      timezone: (cfg['timezone'] as string) ?? 'UTC',
      calendarId: (cfg['calendarId'] as string) ?? '',
      collectionName: (cfg['collectionName'] as string) ?? '',
      endpointUrl: (cfg['endpointUrl'] as string) ?? '',
      httpMethod: (cfg['httpMethod'] as string) ?? 'POST',
      params: (cfg['params'] as Param[]) ?? (cfg['parameters'] as Param[]) ?? [],
      headers: parsedHeaders.length > 0 ? parsedHeaders : [{ key: 'Content-Type', value: 'application/json' }],
      authType,
      authToken: rawAuth?.token ?? '',
      authHeaderName: rawAuth?.headerName ?? '',
      authApiKey: rawAuth?.apiKey ?? '',
      authQueryParam: rawAuth?.queryParam ?? '',
      bodyTemplate: bodyTemplateStr,
      responsePathMapping: rawMapping?.path ?? '',
      responseFormatMapping: rawMapping?.format ?? '',
      timeoutSeconds: cfg['timeoutMs'] ? Math.round((cfg['timeoutMs'] as number) / 1000) : 10,
      mcpServerUrl: (cfg['serverUrl'] as string) ?? '',
      mcpServerName: (cfg['serverName'] as string) ?? '',
      mcpApiKey: (cfg['apiKey'] as string) ?? '',
      mcpTransport: ((cfg['transport'] as string) ?? 'sse') as 'sse' | 'streamable-http',
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

  function addHeader() {
    setField('headers', [...form.headers, { key: '', value: '' }]);
  }

  function updateHeader(idx: number, patch: Partial<HeaderEntry>) {
    setField('headers', form.headers.map((h, i) => (i === idx ? { ...h, ...patch } : h)));
  }

  function removeHeader(idx: number) {
    setField('headers', form.headers.filter((_, i) => i !== idx));
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const newFiles = Array.from(fileList);
    setField('files', [...form.files, ...newFiles]);
  }

  async function handleAddUrl() {
    if (!urlInput.trim()) return;
    try {
      new URL(urlInput.trim());
    } catch {
      toastError('Invalid URL format');
      return;
    }
    setUrlAdding(true);
    try {
      await api.post(`/api/agents/${agentId}/knowledge/web`, { url: urlInput.trim() });
      setUrlInput('');
      await loadKnowledgeFiles();
      success('URL added for processing');
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Failed to add URL');
    } finally {
      setUrlAdding(false);
    }
  }

  async function handleReprocess(fileId: string) {
    try {
      await api.post(`/api/agents/${agentId}/knowledge/${fileId}/reprocess`, {});
      await loadKnowledgeFiles();
      success('Reprocessing started');
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Failed to reprocess');
    }
  }

  async function handleRunTest() {
    if (!editTool) return;
    setTestRunning(true);
    setTestResult(null);
    try {
      const raw = await api.post<{ status: number; latencyMs: number; data: unknown }>(
        `/api/agents/${agentId}/tools/${editTool.id}/test`,
        { params: testInputs }
      );
      setTestResult({ statusCode: raw.status, latencyMs: raw.latencyMs, body: raw.data });
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Test failed');
    } finally {
      setTestRunning(false);
    }
  }

  // ── Tool type config panels ────────────────────────────────────────────────

  function renderCustomFunctionPanel() {
    const showBody = ['POST', 'PUT', 'PATCH'].includes(form.httpMethod);
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

        {/* Parameters */}
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

        {/* Headers */}
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Headers</label>
          <div className={styles.kvList}>
            {form.headers.map((h, i) => (
              <div key={i} className={styles.kvRow}>
                <input
                  className={styles.fieldInput}
                  value={h.key}
                  onChange={(e) => updateHeader(i, { key: e.target.value })}
                  placeholder="Header name"
                />
                <input
                  className={styles.fieldInput}
                  value={h.value}
                  onChange={(e) => updateHeader(i, { value: e.target.value })}
                  placeholder="Value"
                />
                <button className={styles.iconBtn} onClick={() => removeHeader(i)} aria-label="Remove header">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <button className={styles.addParamBtn} onClick={addHeader}>
            <Plus size={12} /> Add Header
          </button>
        </div>

        {/* Authentication */}
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Authentication</label>
          <select
            className={styles.fieldSelect}
            value={form.authType}
            onChange={(e) => setField('authType', e.target.value as ToolForm['authType'])}
          >
            <option value="none">None</option>
            <option value="bearer">Bearer Token</option>
            <option value="api_key_header">API Key Header</option>
            <option value="api_key_query">API Key Query</option>
          </select>
          {form.authType === 'bearer' && (
            <input
              className={styles.fieldInput}
              type="password"
              value={form.authToken}
              onChange={(e) => setField('authToken', e.target.value)}
              placeholder="Bearer token"
              style={{ marginTop: '0.5rem' }}
            />
          )}
          {form.authType === 'api_key_header' && (
            <div className={styles.authSubFields}>
              <input
                className={styles.fieldInput}
                value={form.authHeaderName}
                onChange={(e) => setField('authHeaderName', e.target.value)}
                placeholder="Header name (e.g. X-API-Key)"
              />
              <input
                className={styles.fieldInput}
                type="password"
                value={form.authApiKey}
                onChange={(e) => setField('authApiKey', e.target.value)}
                placeholder="API key value"
              />
            </div>
          )}
          {form.authType === 'api_key_query' && (
            <div className={styles.authSubFields}>
              <input
                className={styles.fieldInput}
                value={form.authQueryParam}
                onChange={(e) => setField('authQueryParam', e.target.value)}
                placeholder="Query param name (e.g. api_key)"
              />
              <input
                className={styles.fieldInput}
                type="password"
                value={form.authApiKey}
                onChange={(e) => setField('authApiKey', e.target.value)}
                placeholder="API key value"
              />
            </div>
          )}
        </div>

        {/* Body Template (POST/PUT/PATCH only) */}
        {showBody && (
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Body Template</label>
            <textarea
              className={styles.fieldTextarea}
              value={form.bodyTemplate}
              onChange={(e) => setField('bodyTemplate', e.target.value)}
              placeholder={'{\n  "name": "{{nombre}}",\n  "date": "{{fecha}}"\n}'}
              rows={5}
              style={{ fontFamily: 'monospace', fontSize: '12px' }}
            />
            <span className={styles.fieldHint}>Use {'{{param}}'} placeholders for parameter values</span>
          </div>
        )}

        {/* Response Mapping */}
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Response Mapping</label>
          <div className={styles.fieldRow}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabelSmall}>Response Path</label>
              <input
                className={styles.fieldInput}
                value={form.responsePathMapping}
                onChange={(e) => setField('responsePathMapping', e.target.value)}
                placeholder="data.result"
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabelSmall}>Display Format</label>
              <input
                className={styles.fieldInput}
                value={form.responseFormatMapping}
                onChange={(e) => setField('responseFormatMapping', e.target.value)}
                placeholder={'Name: {{nombre}}'}
              />
            </div>
          </div>
          <span className={styles.fieldHint}>Optionally map the response to a readable format</span>
        </div>

        {/* Timeout */}
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Timeout (seconds)</label>
          <input
            className={styles.fieldInput}
            type="number"
            min={1}
            max={30}
            value={form.timeoutSeconds}
            onChange={(e) => setField('timeoutSeconds', Math.max(1, Math.min(30, Number(e.target.value))))}
          />
          <span className={styles.fieldHint}>1–30 seconds. Default: 10</span>
        </div>

        {/* Test Panel */}
        <div className={styles.testPanel}>
          <button
            className={styles.testPanelToggle}
            onClick={() => setTestOpen((o) => !o)}
            type="button"
          >
            <Play size={14} />
            <span>Test Function</span>
            {testOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {testOpen && (
            <div className={styles.testPanelBody}>
              {!editTool ? (
                <p className={styles.testPanelInfo}>Save the tool first to test it.</p>
              ) : (
                <>
                  {form.params.length === 0 && (
                    <p className={styles.testPanelInfo}>No parameters defined. Add parameters above to test them.</p>
                  )}
                  {form.params.map((p) => (
                    <div key={p.name} className={styles.fieldGroup}>
                      <label className={styles.fieldLabelSmall}>{p.name || 'unnamed'}{p.required && ' *'}</label>
                      <input
                        className={styles.fieldInput}
                        value={testInputs[p.name] ?? ''}
                        onChange={(e) =>
                          setTestInputs((prev) => ({ ...prev, [p.name]: e.target.value }))
                        }
                        placeholder={`Value for ${p.name}`}
                      />
                    </div>
                  ))}
                  <button
                    className={styles.testRunBtn}
                    onClick={handleRunTest}
                    disabled={testRunning}
                    type="button"
                  >
                    {testRunning ? <Spinner size="sm" /> : <Play size={13} />}
                    <span>{testRunning ? 'Running...' : 'Run Test'}</span>
                  </button>
                  {testResult && (
                    <div className={styles.testResult}>
                      <div className={styles.testResultMeta}>
                        <span className={[
                          styles.testStatusBadge,
                          testResult.statusCode >= 200 && testResult.statusCode < 300
                            ? styles.testStatusOk
                            : styles.testStatusErr,
                        ].join(' ')}>
                          {testResult.statusCode}
                        </span>
                        <span className={styles.testLatency}>{testResult.latencyMs}ms</span>
                      </div>
                      <pre className={styles.testResultBody}>
                        {JSON.stringify(testResult.body, null, 2)}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </>
    );
  }

  function renderSchedulingPanel() {
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
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Calendar</label>
          {calendars.length === 0 ? (
            <p className={styles.fieldHint}>
              No calendars created yet. Create one in the Calendar section.
            </p>
          ) : (
            <select
              className={styles.fieldSelect}
              value={form.calendarId}
              onChange={(e) => setField('calendarId', e.target.value)}
            >
              <option value="">— Select a calendar —</option>
              {calendars.map((cal) => (
                <option key={cal.id} value={cal.id}>{cal.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Agent Functions preview */}
        <div className={styles.agentFunctionsSection}>
          <label className={styles.fieldLabel}>Agent Functions</label>
          <p className={styles.fieldHint}>The LLM will have access to these functions:</p>
          <div className={styles.agentFunctionsList}>
            <div className={styles.agentFunctionRow}>
              <Check size={14} className={styles.agentFunctionIcon} aria-hidden="true" />
              <div>
                <span className={styles.agentFunctionName}>check_availability(date)</span>
                <span className={styles.agentFunctionDesc}>Check available time slots for a given date</span>
              </div>
            </div>
            <div className={styles.agentFunctionRow}>
              <Check size={14} className={styles.agentFunctionIcon} aria-hidden="true" />
              <div>
                <span className={styles.agentFunctionName}>book_appointment(date, time, name, email)</span>
                <span className={styles.agentFunctionDesc}>Book an appointment</span>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  function renderRagPanel() {
    const fileCount = knowledgeFiles.length;
    const limitReached = knowledgeLimit !== Infinity && fileCount >= knowledgeLimit;
    const limitLabel = knowledgeLimit === Infinity ? '∞' : String(knowledgeLimit);

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

        {!editTool ? (
          <p className={styles.fieldHint}>Save the tool first to upload documents.</p>
        ) : (
          <>
            {/* File limit indicator */}
            <div className={styles.fileLimitBar}>
              <span className={styles.fileLimitLabel}>
                Documents: {fileCount} / {limitLabel}
              </span>
              {limitReached && (
                <span className={styles.fileLimitWarning}>
                  File limit reached. Upgrade to add more.
                </span>
              )}
            </div>

            {/* Upload zone */}
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Upload Documents</label>
              <div
                className={[styles.uploadZone, limitReached ? styles.uploadZoneDisabled : ''].filter(Boolean).join(' ')}
                onClick={() => !limitReached && fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!limitReached) handleFiles(e.dataTransfer.files);
                }}
              >
                <Upload size={20} style={{ color: 'var(--color-text-secondary)' }} aria-hidden="true" />
                <span className={styles.uploadZoneText}>
                  {limitReached ? 'File limit reached' : 'Click or drag files here'}
                </span>
                <span className={styles.uploadZoneHint}>PDF, DOCX, TXT — max 20MB each</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className={styles.fileInput}
                multiple
                accept=".pdf,.docx,.txt,.md"
                onChange={(e) => handleFiles(e.target.files)}
                disabled={limitReached}
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

            {/* Separator */}
            <div className={styles.webSeparator}>
              <span>— or index from the web —</span>
            </div>

            {/* Web Pages */}
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Web Pages</label>
              <div className={styles.urlInputRow}>
                <input
                  className={styles.fieldInput}
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/docs"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddUrl(); } }}
                />
                <button
                  className={styles.addUrlBtn}
                  onClick={handleAddUrl}
                  disabled={urlAdding || !urlInput.trim() || limitReached}
                  type="button"
                >
                  {urlAdding ? <Spinner size="sm" /> : <Plus size={14} />}
                  Add URL
                </button>
              </div>
              <span className={styles.fieldHint}>
                Add URLs to scrape and index as knowledge. Each URL counts toward your document limit.
              </span>
            </div>

            {/* Allowed Domains */}
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Allowed Domains <span className={styles.optionalTag}>(optional)</span></label>
              <textarea
                className={styles.fieldTextarea}
                value={form.allowedDomains}
                onChange={(e) => setField('allowedDomains', e.target.value)}
                placeholder="example.com, docs.example.com"
                rows={2}
              />
              <span className={styles.fieldHint}>
                Restrict scraping to these domains. Leave empty to allow only the exact URLs added above.
              </span>
            </div>

            {/* Knowledge files list */}
            {knowledgeLoading ? (
              <div className={styles.knowledgeLoading}>
                <Spinner size="sm" />
                <span>Loading files...</span>
              </div>
            ) : knowledgeFiles.length > 0 ? (
              <div className={styles.knowledgeFileList}>
                {knowledgeFiles.map((kf) => (
                  <div key={kf.id} className={styles.knowledgeFileRow}>
                    <div className={styles.knowledgeFileInfo}>
                      <span className={styles.knowledgeFileName}>
                        {kf.sourceUrl ?? kf.filename}
                      </span>
                      {kf.fileSize && (
                        <span className={styles.fileSize}>{formatBytes(kf.fileSize)}</span>
                      )}
                    </div>
                    <div className={styles.knowledgeFileStatus}>
                      {kf.status === 'processing' && (
                        <span className={styles.statusProcessing}>
                          <Spinner size="sm" />
                          Processing...
                        </span>
                      )}
                      {kf.status === 'ready' && (
                        <span className={styles.statusReady}>
                          <Check size={12} />
                          Ready · {kf.chunkCount} chunks
                        </span>
                      )}
                      {kf.status === 'error' && (
                        <span className={styles.statusError} title={kf.errorMessage ?? ''}>
                          Error
                        </span>
                      )}
                    </div>
                    <button
                      className={styles.iconBtn}
                      onClick={() => handleReprocess(kf.id)}
                      aria-label="Reprocess file"
                      title="Reprocess"
                    >
                      <RefreshCw size={13} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </>
    );
  }

  function renderMcpPanel() {
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
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Transport</label>
          <select
            className={styles.fieldSelect}
            value={form.mcpTransport}
            onChange={(e) => setField('mcpTransport', e.target.value as ToolForm['mcpTransport'])}
          >
            <option value="sse">Server-Sent Events (SSE)</option>
            <option value="streamable-http">Streamable HTTP</option>
          </select>
        </div>
      </>
    );
  }

  function renderConfigPanel() {
    switch (activeType) {
      case 'custom_function':
        return renderCustomFunctionPanel();
      case 'scheduling':
        return renderSchedulingPanel();
      case 'rag':
        return renderRagPanel();
      case 'mcp':
        return renderMcpPanel();
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
                  <Toggle checked={tool.isEnabled ?? false} onChange={() => handleToggle(tool)} />
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
                const isCustomFn = cat.type === 'custom_function';
                const isMcp = cat.type === 'mcp';
                const isDisabled = !!editTool ||
                  (isCustomFn && !canUseCustomFunction) ||
                  (isMcp && !canUseMcp);
                const needsUpgrade =
                  (isCustomFn && !canUseCustomFunction) ||
                  (isMcp && !canUseMcp);

                return (
                  <button
                    key={cat.type}
                    className={[
                      styles.catalogBtn,
                      activeType === cat.type ? styles.catalogBtnActive : '',
                      needsUpgrade ? styles.catalogBtnDisabled : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => {
                      if (isDisabled) return;
                      setActiveType(cat.type);
                      setField('type', cat.type);
                    }}
                    disabled={isDisabled}
                    title={needsUpgrade ? 'Upgrade your plan to use this tool' : undefined}
                  >
                    <CatIcon size={15} className={styles.catalogBtnIcon} aria-hidden="true" />
                    <span className={styles.catalogBtnLabel}>{cat.label}</span>
                    {needsUpgrade && (
                      <span className={styles.upgradeBadge}>Upgrade</span>
                    )}
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
