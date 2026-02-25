'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Wand2, Loader2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import styles from './new.module.css';

type Method = 'template' | 'scratch';

interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
}

interface Agent {
  id: string;
}

export default function NewAgentPage() {
  const router = useRouter();
  const { error: toastError } = useToast();
  const [method, setMethod] = useState<Method | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (method === 'template') {
      setLoadingTemplates(true);
      api.get<{ templates: Template[] }>('/api/agents/templates')
        .then((d) => setTemplates(d.templates))
        .catch(() => toastError('Failed to load templates'))
        .finally(() => setLoadingTemplates(false));
    }
  }, [method, toastError]);

  async function handleCreateFromScratch(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const data = await api.post<{ agent: Agent }>('/api/agents', {
        name: name.trim(),
        description: description.trim() || undefined,
        systemPrompt: 'You are a helpful assistant.',
        llmProvider: 'openai',
        llmModel: 'gpt-4o-mini',
      });
      const newId = data.agent?.id;
      if (!newId) {
        toastError('Agent created but could not redirect. Please check the agents list.');
        router.push('/dashboard/agents');
        return;
      }
      router.push(`/dashboard/agents/${newId}`);
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Failed to create agent');
      setCreating(false);
    }
  }

  async function handleCreateFromTemplate() {
    if (!selectedTemplate) return;
    setCreating(true);
    try {
      const data = await api.post<{ agent: Agent }>(`/api/agents/from-template/${selectedTemplate.id}`, {});
      const newId = data.agent?.id;
      if (!newId) {
        toastError('Agent created but could not redirect. Please check the agents list.');
        router.push('/dashboard/agents');
        return;
      }
      router.push(`/dashboard/agents/${newId}`);
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Failed to create agent');
      setCreating(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Create New Agent</h1>
        <p className={styles.pageDesc}>Choose how you want to get started.</p>
      </div>

      {!method && (
        <div className={styles.step}>
          <h2 className={styles.stepTitle}>How would you like to start?</h2>
          <p className={styles.stepDesc}>You can always customize everything later.</p>
          <div className={styles.methods}>
            <button className={styles.methodCard} onClick={() => setMethod('template')}>
              <div className={styles.methodIcon}>
                <Wand2 size={22} />
              </div>
              <div className={styles.methodTitle}>Start from Template</div>
              <div className={styles.methodDesc}>
                Use a pre-built template with system prompt, variables, and tools already configured.
              </div>
            </button>
            <button className={styles.methodCard} onClick={() => setMethod('scratch')}>
              <div className={styles.methodIcon}>
                <Bot size={22} />
              </div>
              <div className={styles.methodTitle}>Start from Scratch</div>
              <div className={styles.methodDesc}>
                Build a custom agent with a blank slate. Full control over every setting.
              </div>
            </button>
          </div>
        </div>
      )}

      {method === 'template' && (
        <div className={styles.step}>
          <h2 className={styles.stepTitle}>Choose a Template</h2>
          <p className={styles.stepDesc}>Select a template to get started quickly.</p>

          {loadingTemplates ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <Spinner size="md" />
            </div>
          ) : (
            <div className={styles.templatesGrid}>
              {templates.map((t) => (
                <div
                  key={t.id}
                  className={`${styles.templateCard} ${selectedTemplate?.id === t.id ? styles.selected : ''}`}
                  onClick={() => setSelectedTemplate(t)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') setSelectedTemplate(t); }}
                >
                  <div className={styles.templateName}>{t.name}</div>
                  <div className={styles.templateDesc}>{t.description}</div>
                </div>
              ))}
            </div>
          )}

          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => { setMethod(null); setSelectedTemplate(null); }}>
              Back
            </Button>
            <Button
              onClick={handleCreateFromTemplate}
              loading={creating}
              disabled={!selectedTemplate}
              icon={creating ? Loader2 : undefined}
            >
              Create from Template
            </Button>
          </div>
        </div>
      )}

      {method === 'scratch' && (
        <div className={styles.step}>
          <h2 className={styles.stepTitle}>Agent Details</h2>
          <p className={styles.stepDesc}>Give your agent a name to get started.</p>
          <form onSubmit={handleCreateFromScratch} className={styles.formSection}>
            <Input
              label="Agent Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Lead Capture Bot"
              required
              autoFocus
            />
            <Input
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this agent do?"
            />
            <div className={styles.actions}>
              <Button variant="secondary" type="button" onClick={() => setMethod(null)}>
                Back
              </Button>
              <Button type="submit" loading={creating} disabled={!name.trim()}>
                Create Agent
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
