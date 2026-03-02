'use client';

import Link from 'next/link';
import { ArrowRight, Tag } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';
import { useTranslation } from '@/hooks/useTranslation';
import { formatDate } from '@/lib/formatters';
import styles from './BlogPreview.module.css';

interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  language: string;
}

const PLACEHOLDER_POSTS: BlogPost[] = [
  {
    slug: 'how-to-deploy-whatsapp-ai-agent',
    title: 'How to Deploy a WhatsApp AI Agent in Under 10 Minutes',
    description: 'Step-by-step guide to creating and deploying your first AI-powered WhatsApp chatbot with GenSmart.',
    date: '2026-02-20',
    tags: ['whatsapp', 'tutorial'],
    language: 'en',
  },
  {
    slug: 'ai-lead-scoring-explained',
    title: 'AI Lead Scoring: How Smart CRM Prioritizes Your Best Prospects',
    description: 'Learn how AI-powered lead scoring helps you focus on high-value prospects and close more deals.',
    date: '2026-02-15',
    tags: ['crm', 'ai-scoring'],
    language: 'en',
  },
  {
    slug: 'n8n-vs-gensmart-comparison',
    title: 'N8N vs GenSmart: Why All-in-One Beats DIY for AI Agents',
    description: "A practical comparison of building AI agents with N8N workflows versus GenSmart's integrated platform.",
    date: '2026-02-10',
    tags: ['comparison', 'automation'],
    language: 'en',
  },
  {
    slug: 'como-desplegar-agente-whatsapp-ia',
    title: 'Cómo desplegar tu primer agente de IA en WhatsApp (sin código)',
    description: 'Guía paso a paso para conectar GenSmart con WhatsApp Business y automatizar tus conversaciones desde el primer día.',
    date: '2026-02-20',
    tags: ['whatsapp', 'guía'],
    language: 'es',
  },
  {
    slug: 'lead-scoring-ia-crm',
    title: 'Lead Scoring con IA: cómo priorizar tus mejores prospectos automáticamente',
    description: 'Descubre cómo el scoring automático de leads con IA puede triplicar tu tasa de conversión sin aumentar tu equipo de ventas.',
    date: '2026-02-25',
    tags: ['crm', 'lead-scoring'],
    language: 'es',
  },
  {
    slug: 'gensmart-vs-n8n-automatizacion',
    title: 'GenSmart vs n8n: ¿cuál elegir para automatizar tus conversaciones con IA?',
    description: 'Comparativa honesta entre GenSmart y n8n para empresas que quieren automatizar su atención al cliente con IA.',
    date: '2026-03-01',
    tags: ['comparativa', 'automatización'],
    language: 'es',
  },
];

interface BlogPreviewProps {
  posts?: BlogPost[];
}

export function BlogPreview({ posts = PLACEHOLDER_POSTS }: BlogPreviewProps) {
  const { t, language } = useTranslation();
  const displayPosts = posts.filter((p) => p.language === language).slice(0, 3);

  return (
    <section className={styles.section} aria-label="Blog preview">
      <div className={styles.inner}>
        <ScrollReveal>
          <div className={styles.header}>
            <h2 className={styles.title}>{t('landing.blogPreview.title')}</h2>
            <p className={styles.subtitle}>{t('landing.blogPreview.subtitle')}</p>
          </div>
        </ScrollReveal>

        <div className={styles.grid}>
          {displayPosts.map((post, i) => (
            <ScrollReveal key={post.slug} delay={i * 100}>
              <article className={styles.card}>
                <div className={styles.cardCover} aria-hidden="true">
                  <div className={styles.coverPattern} />
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.tags}>
                    {post.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className={styles.tag}>
                        <Tag size={10} aria-hidden="true" />
                        {tag}
                      </span>
                    ))}
                  </div>
                  <h3 className={styles.cardTitle}>
                    <Link href={`/blog/${post.slug}`} className={styles.cardTitleLink}>
                      {post.title}
                    </Link>
                  </h3>
                  <p className={styles.cardDesc}>{post.description}</p>
                  <div className={styles.cardFooter}>
                    <time className={styles.date} dateTime={post.date}>
                      {formatDate(post.date, language)}
                    </time>
                    <Link href={`/blog/${post.slug}`} className={styles.readMore}>
                      {t('landing.blogPreview.readMore')}
                      <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </article>
            </ScrollReveal>
          ))}
        </div>

        <div className={styles.footer}>
          <Link href="/blog" className={styles.viewAllLink}>
            {t('landing.blogPreview.viewAll')}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
