'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import ContactHeader from '@/components/crm/ContactHeader';
import ContactSummary from '@/components/crm/ContactSummary';
import ContactNotes from '@/components/crm/ContactNotes';
import ContactConversations from '@/components/crm/ContactConversations';
import ContactVariables from '@/components/crm/ContactVariables';
import ContactTimeline from '@/components/crm/ContactTimeline';
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

  const [contact, setContact] = useState<Contact | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
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
      toast.error('Failed to load contact');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleUpdate = async (data: Partial<{ name: string; phone: string; email: string }>) => {
    try {
      const res = await api.put<{ contact: Contact }>(`/api/contacts/${id}`, data);
      setContact(res.contact);
      toast.success('Contact updated');
    } catch {
      toast.error('Failed to update contact');
    }
  };

  const handleStageChange = async (stage: string) => {
    try {
      const res = await api.put<{ contact: Contact }>(`/api/contacts/${id}/stage`, { stage });
      setContact(res.contact);
      toast.success('Stage updated');
    } catch {
      toast.error('Failed to update stage');
    }
  };

  const handleSaveNotes = async (notes: string) => {
    try {
      const res = await api.put<{ contact: Contact }>(`/api/contacts/${id}`, { notes });
      setContact(res.contact);
      toast.success('Notes saved');
    } catch {
      toast.error('Failed to save notes');
    }
  };

  const handleReanalyze = async () => {
    try {
      await api.post(`/api/contacts/${id}/analyze`);
      toast.success('Analysis queued — results will appear shortly');
    } catch {
      toast.error('No conversation found to analyze');
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
        <p>Contact not found.</p>
        <Button variant="ghost" icon={ArrowLeft} onClick={() => router.push('/dashboard/contacts')}>
          Back to Contacts
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
          Contacts
        </Button>
        <span className={styles.breadcrumbSep}>/</span>
        <span className={styles.breadcrumbCurrent}>{contact.name ?? 'Unknown'}</span>
      </div>

      <div className={styles.layout}>
        {/* Left column */}
        <div className={styles.left}>
          <ContactHeader
            contact={contact}
            onUpdate={handleUpdate}
            onStageChange={handleStageChange}
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
