'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import SearchInput from '@/components/ui/SearchInput';
import styles from './ContactFilters.module.css';

interface Agent {
  id: string;
  name: string;
}

interface ContactFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  agentId: string;
  onAgentChange: (v: string) => void;
  stage: string;
  onStageChange: (v: string) => void;
  scoreRange: string;
  onScoreRangeChange: (v: string) => void;
  agents: Agent[];
}

const STAGE_OPTIONS = [
  { value: '', label: 'All Stages' },
  { value: 'lead', label: 'Lead' },
  { value: 'opportunity', label: 'Opportunity' },
  { value: 'customer', label: 'Customer' },
];

const SCORE_OPTIONS = [
  { value: '', label: 'All Scores' },
  { value: '0-3', label: 'Low (0–3)' },
  { value: '4-6', label: 'Medium (4–6)' },
  { value: '7-10', label: 'High (7–10)' },
];

export default function ContactFilters({
  search,
  onSearchChange,
  agentId,
  onAgentChange,
  stage,
  onStageChange,
  scoreRange,
  onScoreRangeChange,
  agents,
}: ContactFiltersProps) {
  return (
    <div className={styles.filters}>
      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder="Search by name, email or phone…"
        className={styles.search}
      />

      <div className={styles.selectWrap}>
        <select
          className={styles.select}
          value={agentId}
          onChange={(e) => onAgentChange(e.target.value)}
          aria-label="Filter by agent"
        >
          <option value="">All Agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <ChevronDown size={14} className={styles.chevron} aria-hidden="true" />
      </div>

      <div className={styles.selectWrap}>
        <select
          className={styles.select}
          value={stage}
          onChange={(e) => onStageChange(e.target.value)}
          aria-label="Filter by stage"
        >
          {STAGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown size={14} className={styles.chevron} aria-hidden="true" />
      </div>

      <div className={styles.selectWrap}>
        <select
          className={styles.select}
          value={scoreRange}
          onChange={(e) => onScoreRangeChange(e.target.value)}
          aria-label="Filter by score"
        >
          {SCORE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown size={14} className={styles.chevron} aria-hidden="true" />
      </div>
    </div>
  );
}
