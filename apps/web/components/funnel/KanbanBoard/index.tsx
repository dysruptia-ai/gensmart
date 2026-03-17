'use client';

import React, { useState } from 'react';
import { UserPlus, TrendingUp, CheckCircle } from 'lucide-react';
import KanbanColumn from '@/components/funnel/KanbanColumn';
import styles from './KanbanBoard.module.css';

interface KanbanContact {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  ai_score: number | null;
  ai_service: string | null;
  source_channel: string | null;
  agent_name: string | null;
  funnel_stage: string;
  created_at: string;
}

interface StageData {
  id: string;
  name: string;
  contacts: KanbanContact[];
  count: number;
}

interface KanbanBoardProps {
  stages: StageData[];
  onMove: (contactId: string, fromStage: string, toStage: string) => Promise<void>;
}

const STAGE_ICONS = {
  lead: UserPlus,
  opportunity: TrendingUp,
  customer: CheckCircle,
};

const STAGE_COLOR_CLASS: Record<string, string> = {
  lead: 'lead',
  opportunity: 'opportunity',
  customer: 'customer',
};

export default function KanbanBoard({ stages, onMove }: KanbanBoardProps) {
  const [dragContactId, setDragContactId] = useState<string | null>(null);
  const [dragFromStage, setDragFromStage] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, contactId: string, stage: string) => {
    setDragContactId(contactId);
    setDragFromStage(stage);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    setDragOverStage(stage);
  };

  const handleDrop = async (e: React.DragEvent, toStage: string) => {
    e.preventDefault();
    setDragOverStage(null);

    if (!dragContactId || !dragFromStage || dragFromStage === toStage) {
      setDragContactId(null);
      setDragFromStage(null);
      return;
    }

    await onMove(dragContactId, dragFromStage, toStage);
    setDragContactId(null);
    setDragFromStage(null);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  return (
    <div className={styles.board}>
      {stages.map((stage) => {
        const Icon = STAGE_ICONS[stage.id as keyof typeof STAGE_ICONS] ?? UserPlus;
        return (
          <KanbanColumn
            key={stage.id}
            id={stage.id}
            name={stage.name}
            icon={Icon}
            contacts={stage.contacts}
            colorClass={STAGE_COLOR_CLASS[stage.id] ?? 'lead'}
            isDragOver={dragOverStage === stage.id}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragLeave={handleDragLeave}
          />
        );
      })}
    </div>
  );
}
