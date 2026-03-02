'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useWebSocket } from '@/hooks/useWebSocket';
import ContactHeader from '@/components/crm/ContactHeader';
import ContactSummary from '@/components/crm/ContactSummary';
import ContactNotes from '@/components/crm/ContactNotes';
import ContactConversations from '@/components/crm/ContactConversations';
import ContactVariables from '@/components/crm/ContactVariables';
import ContactTimeline from '@/components/crm/ContactTimeline';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './contact-detail.module.css';

interface Contact {
  id: string;
  agent_id: string | null;
  agent_name: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  ai_summary: string | null;
  ai_score: number | null;
  ai_service: string | null;
  funnel_stage: string;
  funnel_updated_at: string | null;
  custom_variables: Record<string, unknown>;
  source_channel: string | null;
  tags: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ConversationItem {
  id: string;
  agent_name: string | null;
  channel: string;
  status: string;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
}

interface TimelineEvent {
  type: string;
  description: string;
  date: string;
  metadata?: Record<string, unknown>;
}

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params['id'] ?? '');
  const toast = useToast();
  const { t } = useTranslation();

  const { on, off } = useWebSocket();
  const isDeletingRef = React.useRef(false);

  const [contact, setContact] = useState<Contact | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContact = useCallback(async () => {
    if (isDeletingRef.current) return;
    const res = await api.get<{ contact: Contact }>(`/api/contacts/${id}`);
    setContact(res.contact);
  }, [id]);

  const fetchTimeline = useCallback(async () => {
    if (isDeletingRef.current) return;
    const res = await api.get<{ events: TimelineEvent[] }>(`/api/contacts/${id}/timeline`);
    setTimeline(res.events);
  }, [id]);

  const fetchAll = useCallback(async () => {
    if (isDeletingRef.current) return;
    setLoading(true);
    try {
      const [contactRes, convsRes, timelineRes] = await Promise.all([
        api.get<{ contact: Contact }>(`/api/contacts/${id}`),
        api.get<{ conversations: ConversationItem[] }>(`/api/contacts/${id}/conversations`),
        api.get<{ events: TimelineEvent[] }>(`/api/contacts/${id}/timeline`),
      ]);
      setContact(contactRes.contact);
      setConversations(convsRes.conversations);
      setTimeline(timelineRes.events);
    } catch {
      toast.error(t('contacts.detail.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Real-time refresh via WebSocket
  useEffect(() => {
    const handleVarsUpdate = (data: {
      conversationId: string;
      contactId?: string | null;
      variables: Record<string, unknown>;
    }) => {
      if (data.contactId === id) {
        void fetchContact();
        void fetchTimeline();
      }
    };

    const handleScored = (data: {
      contactId: string | null;
      conversationId: string;
      score: number;
      summary: string;
      service: string;
      funnelStage?: string;
    }) => {
      if (data.contactId === id) {
        void fetchContact();
        void fetchTimeline();
      }
    };

    on('variables:update', handleVarsUpdate);
    on('contact:scored', handleScored);

    return () => {
      off('variables:update', handleVarsUpdate);
      off('contact:scored', handleScored);
    };
  }, [id, on, off, fetchContact, fetchTimeline]);

  const handleUpdate = async (data: Partial<{ name: string; phone: string; email: string }>) => {
    try {
      const res = await api.put<{ contact: Contact }>(`/api/contacts/${id}`, data);
      setContact(res.contact);
      toast.success(t('contacts.detail.updateSuccess'));
    } catch {
      toast.error(t('contacts.detail.updateFailed'));
    }
  };

  const handleStageChange = async (stage: string) => {
    try {
      const res = await api.put<{ contact: Contact }>(`/api/contacts/${id}/stage`, { stage });
      setContact(res.contact);
      toast.success(t('contacts.detail.stageSuccess'));
    } catch {
      toast.error(t('contacts.detail.stageFailed'));
    }
  };

  const handleSaveNotes = async (notes: string) => {
    try {
      const res = await api.put<{ contact: Contact }>(`/api/contacts/${id}`, { notes });
      setContact(res.contact);
      toast.success(t('contacts.detail.notesSaved'));
    } catch {
      toast.error(t('contacts.detail.notesFailed'));
    }
  };

  const handleDelete = async () => {
    isDeletingRef.current = true;
    await api.delete(`/api/contacts/${id}`);
    toast.success(t('contacts.detail.deleted'));
    router.push('/dashboard/contacts');
  };

  const handleReanalyze = async () => {
    try {
      await api.post(`/api/contacts/${id}/analyze`);
      toast.success(t('contacts.detail.analyzeQueued'));
    } catch {
      toast.error(t('contacts.detail.analyzeFailed'));
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingPage}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className={styles.notFound}>
        <p>{t('contacts.detail.notFound')}</p>
        <Button variant="ghost" icon={ArrowLeft} onClick={() => router.push('/dashboard/contacts')}>
          {t('contacts.detail.back')}
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <Button
          variant="ghost"
          size="sm"
          icon={ArrowLeft}
          onClick={() => router.push('/dashboard/contacts')}
        >
          {t('contacts.title')}
        </Button>
        <span className={styles.breadcrumbSep}>/</span>
        <span className={styles.breadcrumbCurrent}>{contact.name ?? t('common.name')}</span>
      </div>

      <div className={styles.layout}>
        {/* Left column */}
        <div className={styles.left}>
          <ContactHeader
            contact={contact}
            onUpdate={handleUpdate}
            onStageChange={handleStageChange}
            onDelete={handleDelete}
          />
          <ContactSummary
            summary={contact.ai_summary}
            service={contact.ai_service}
            onReanalyze={handleReanalyze}
          />
          <ContactNotes notes={contact.notes} onSave={handleSaveNotes} />
          <ContactConversations conversations={conversations} />
        </div>

        {/* Right column */}
        <div className={styles.right}>
          <ContactVariables variables={contact.custom_variables ?? {}} />
          <ContactTimeline events={timeline} />
        </div>
      </div>
    </div>
  );
}
