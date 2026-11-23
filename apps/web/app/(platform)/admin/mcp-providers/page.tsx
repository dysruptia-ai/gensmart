'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Plug } from 'lucide-react';
import { z } from 'zod';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import Modal from '@/components/ui/Modal';
import styles from './page.module.css';

interface ProviderProfile {
  id: string;
  name: string;
  description?: string;
  logo_url?: string;
  match_url_pattern: string;
  match_strategy: 'domain_contains' | 'domain_exact' | 'url_prefix' | 'regex';
  default_transport: 'sse' | 'streamable-http';
  default_server_url?: string;
  auto_injected_headers: Array<{ key: string; value_ref: string; description?: string }>;
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
  is_active: boolean;
  updated_at?: string;
}

const valueRefRegex = /^(platform_setting|fixed):/;

const autoHeaderSchema = z.object({
  key: z.string().min(1).max(100),
  value_ref: z.string().regex(valueRefRegex),
  description: z.string().max(500).optional(),
});

const userHeaderSchema = z.object({
  key: z.string().min(1).max(100),
  label_en: z.string().min(1).max(100),
  label_es: z.string().min(1).max(100),
  help_url: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  help_text_en: z.string().max(500).optional(),
  help_text_es: z.string().max(500).optional(),
  required: z.boolean(),
  min_length: z.number().int().min(1).max(1000).optional(),
});

const providerSchema = z.object({
  id: z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/, 'lowercase alphanumeric with - or _'),
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  logo_url: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  match_url_pattern: z.string().min(1).max(500),
  match_strategy: z.enum(['domain_contains', 'domain_exact', 'url_prefix', 'regex']),
  default_transport: z.enum(['sse', 'streamable-http']),
  default_server_url: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  auto_injected_headers: z.array(autoHeaderSchema).max(20),
  user_configurable_headers: z.array(userHeaderSchema).max(20),
  supported_events: z.array(z.string().min(1)).max(50),
  is_active: z.boolean(),
});

interface FormState {
  id: string;
  name: string;
  description: string;
  logo_url: string;
  match_url_pattern: string;
  match_strategy: ProviderProfile['match_strategy'];
  default_transport: ProviderProfile['default_transport'];
  default_server_url: string;
  auto_injected_headers_json: string;
  user_configurable_headers_json: string;
  supported_events_json: string;
  is_active: boolean;
}

const EMPTY_FORM: FormState = {
  id: '',
  name: '',
  description: '',
  logo_url: '',
  match_url_pattern: '',
  match_strategy: 'domain_contains',
  default_transport: 'streamable-http',
  default_server_url: '',
  auto_injected_headers_json: '[\n  {"key": "X-MCP-API-Key", "value_ref": "platform_setting:my_provider_api_key"}\n]',
  user_configurable_headers_json: '[\n  {\n    "key": "X-Customer-Api-Key",\n    "label_en": "Your API Key",\n    "label_es": "Tu API Key",\n    "required": true,\n    "min_length": 16\n  }\n]',
  supported_events_json: '[]',
  is_active: true,
};

export default function MCPProvidersAdminPage() {
  const toast = useToast();
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ providers: ProviderProfile[] }>('/api/admin/mcp-providers');
      setProviders(data.providers);
    } catch {
      toast.error('Failed to load providers');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(profile: ProviderProfile) {
    setEditingId(profile.id);
    setForm({
      id: profile.id,
      name: profile.name,
      description: profile.description ?? '',
      logo_url: profile.logo_url ?? '',
      match_url_pattern: profile.match_url_pattern,
      match_strategy: profile.match_strategy,
      default_transport: profile.default_transport,
      default_server_url: profile.default_server_url ?? '',
      auto_injected_headers_json: JSON.stringify(profile.auto_injected_headers ?? [], null, 2),
      user_configurable_headers_json: JSON.stringify(profile.user_configurable_headers ?? [], null, 2),
      supported_events_json: JSON.stringify(profile.supported_events ?? [], null, 2),
      is_active: profile.is_active,
    });
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Parse JSON fields
      let autoHeaders: unknown;
      let userHeaders: unknown;
      let events: unknown;
      try {
        autoHeaders = JSON.parse(form.auto_injected_headers_json);
        userHeaders = JSON.parse(form.user_configurable_headers_json);
        events = JSON.parse(form.supported_events_json);
      } catch (err) {
        toast.error(`Invalid JSON: ${(err as Error).message}`);
        setSaving(false);
        return;
      }

      const payload = {
        id: form.id,
        name: form.name,
        description: form.description || undefined,
        logo_url: form.logo_url || undefined,
        match_url_pattern: form.match_url_pattern,
        match_strategy: form.match_strategy,
        default_transport: form.default_transport,
        default_server_url: form.default_server_url || undefined,
        auto_injected_headers: autoHeaders,
        user_configurable_headers: userHeaders,
        supported_events: events,
        is_active: form.is_active,
      };

      const validated = providerSchema.safeParse(payload);
      if (!validated.success) {
        const first = validated.error.issues[0];
        toast.error(`${first?.path.join('.') ?? 'form'}: ${first?.message ?? 'invalid'}`);
        setSaving(false);
        return;
      }

      if (editingId) {
        // PUT — id is path param, not in body
        const { id: _id, ...body } = validated.data;
        void _id;
        await api.put(`/api/admin/mcp-providers/${editingId}`, body);
        toast.success('Provider updated');
      } else {
        await api.post('/api/admin/mcp-providers', validated.data);
        toast.success('Provider created');
      }

      setShowModal(false);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to save provider');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(profile: ProviderProfile) {
    if (!confirm(`Deactivate provider "${profile.name}"? Existing tools that reference it will keep working until you re-activate or rebuild.`)) {
      return;
    }
    try {
      await api.delete(`/api/admin/mcp-providers/${profile.id}`);
      toast.success('Provider deactivated');
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to deactivate');
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <Plug size={20} aria-hidden="true" />
            MCP Provider Profiles
          </h1>
          <p className={styles.subtitle}>
            Pre-configured catalog of known MCP providers. Customers can pick from these in one click instead of configuring headers manually.
          </p>
        </div>
        <Button variant="primary" onClick={openCreate}>
          <Plus size={16} /> Add Provider
        </Button>
      </div>

      {loading ? (
        <div className={styles.loading}><Spinner size="lg" /></div>
      ) : providers.length === 0 ? (
        <div className={styles.empty}>No providers yet. Click &quot;Add Provider&quot; to create one.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Match Pattern</th>
                <th>Strategy</th>
                <th>Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr key={p.id}>
                  <td><code>{p.id}</code></td>
                  <td>{p.name}</td>
                  <td className={styles.mono}>{p.match_url_pattern}</td>
                  <td>{p.match_strategy}</td>
                  <td>
                    <span className={p.is_active ? styles.badgeActive : styles.badgeInactive}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className={styles.actions}>
                    <button className={styles.actionBtn} onClick={() => openEdit(p)} title="Edit">
                      <Edit2 size={14} />
                    </button>
                    {p.is_active && (
                      <button className={styles.actionBtnDanger} onClick={() => handleDelete(p)} title="Deactivate">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? `Edit Provider: ${editingId}` : 'New Provider Profile'}
        size="lg"
      >
        <div className={styles.form}>
          <div className={styles.formRow}>
            <label className={styles.label}>
              ID
              <input
                className={styles.input}
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                placeholder="mastershop"
                disabled={!!editingId}
              />
              <span className={styles.hint}>lowercase, alphanumeric, dashes/underscores. Cannot be changed after creation.</span>
            </label>
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>
              Name
              <input
                className={styles.input}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Mastershop Dropshipping"
              />
            </label>
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>
              Description
              <textarea
                className={styles.textarea}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </label>
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>
              Logo URL
              <input
                className={styles.input}
                value={form.logo_url}
                onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                placeholder="Leave empty for auto-generated placeholder"
              />
            </label>
          </div>
          <div className={styles.grid2}>
            <label className={styles.label}>
              Match URL Pattern
              <input
                className={styles.input}
                value={form.match_url_pattern}
                onChange={(e) => setForm({ ...form, match_url_pattern: e.target.value })}
                placeholder="mcp.example.com"
              />
            </label>
            <label className={styles.label}>
              Match Strategy
              <select
                className={styles.input}
                value={form.match_strategy}
                onChange={(e) => setForm({ ...form, match_strategy: e.target.value as FormState['match_strategy'] })}
              >
                <option value="domain_contains">domain_contains</option>
                <option value="domain_exact">domain_exact</option>
                <option value="url_prefix">url_prefix</option>
                <option value="regex">regex</option>
              </select>
            </label>
          </div>
          <div className={styles.grid2}>
            <label className={styles.label}>
              Default Transport
              <select
                className={styles.input}
                value={form.default_transport}
                onChange={(e) => setForm({ ...form, default_transport: e.target.value as FormState['default_transport'] })}
              >
                <option value="streamable-http">streamable-http</option>
                <option value="sse">sse</option>
              </select>
            </label>
            <label className={styles.label}>
              Default Server URL
              <input
                className={styles.input}
                value={form.default_server_url}
                onChange={(e) => setForm({ ...form, default_server_url: e.target.value })}
                placeholder="https://mcp.example.com/mcp"
              />
            </label>
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>
              Auto-Injected Headers (JSON)
              <textarea
                className={styles.codeArea}
                value={form.auto_injected_headers_json}
                onChange={(e) => setForm({ ...form, auto_injected_headers_json: e.target.value })}
                rows={6}
                spellCheck={false}
              />
              <span className={styles.hint}>
                Each entry: {`{"key": "X-...", "value_ref": "platform_setting:foo" | "fixed:literal", "description"?: ""}`}
              </span>
            </label>
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>
              User-Configurable Headers (JSON)
              <textarea
                className={styles.codeArea}
                value={form.user_configurable_headers_json}
                onChange={(e) => setForm({ ...form, user_configurable_headers_json: e.target.value })}
                rows={8}
                spellCheck={false}
              />
              <span className={styles.hint}>
                Each entry: {`{"key", "label_en", "label_es", "help_url"?, "help_text_en"?, "help_text_es"?, "required", "min_length"?}`}
              </span>
            </label>
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>
              Supported Events (JSON array of strings)
              <textarea
                className={styles.codeArea}
                value={form.supported_events_json}
                onChange={(e) => setForm({ ...form, supported_events_json: e.target.value })}
                rows={3}
                spellCheck={false}
              />
            </label>
          </div>
          <div className={styles.formRow}>
            <label className={styles.toggleRow}>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              <span>Active (visible in customer-facing provider catalog)</span>
            </label>
          </div>

          <div className={styles.formActions}>
            <Button variant="secondary" onClick={() => setShowModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? <Spinner size="sm" /> : editingId ? 'Save Changes' : 'Create Provider'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
