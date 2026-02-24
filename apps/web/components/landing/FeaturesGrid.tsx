import {
  Bot,
  MessageCircle,
  Users,
  GitBranch,
  Calendar,
  BookOpen,
  UserCheck,
  Plug,
} from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';
import styles from './FeaturesGrid.module.css';

const FEATURES = [
  {
    icon: Bot,
    title: 'AI Agents',
    description: 'Create intelligent conversational agents powered by GPT-4o & Claude',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp & Web',
    description: 'Deploy on WhatsApp Business and your website with one click',
  },
  {
    icon: Users,
    title: 'Smart CRM',
    description: 'AI-powered lead scoring, summaries, and contact management',
  },
  {
    icon: GitBranch,
    title: 'Sales Funnel',
    description: 'Visual kanban pipeline from lead to customer',
  },
  {
    icon: Calendar,
    title: 'Scheduling',
    description: 'Let your agent book appointments automatically',
  },
  {
    icon: BookOpen,
    title: 'Knowledge Base',
    description: 'Upload docs and URLs — your agent learns your business',
  },
  {
    icon: UserCheck,
    title: 'Human Takeover',
    description: 'Jump into any conversation when the AI needs help',
  },
  {
    icon: Plug,
    title: 'Custom Functions & MCP',
    description: 'Connect to any API or MCP server for live data',
  },
];

export function FeaturesGrid() {
  return (
    <section id="features" className={styles.section} aria-label="Features">
      <div className={styles.inner}>
        <ScrollReveal>
          <div className={styles.header}>
            <span className={styles.eyebrow}>Everything you need</span>
            <h2 className={styles.title}>One Platform. Every Feature.</h2>
            <p className={styles.subtitle}>
              Replace your entire automation stack with a single, integrated
              platform built for AI-powered customer conversations.
            </p>
          </div>
        </ScrollReveal>

        <div className={styles.grid}>
          {FEATURES.map(({ icon: Icon, title, description }, i) => (
            <ScrollReveal key={title} delay={i * 60}>
              <article className={styles.card}>
                <div className={styles.iconWrap} aria-hidden="true">
                  <Icon size={24} />
                </div>
                <h3 className={styles.cardTitle}>{title}</h3>
                <p className={styles.cardDesc}>{description}</p>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
