'use client';

import Link from 'next/link';
import { ArrowRight, Tag } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { formatDate } from '@/lib/formatters';
import styles from './blog.module.css';

interface Post {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  tags: string[];
  language: string;
}

interface BlogContentProps {
  posts: Post[];
}

export default function BlogContent({ posts }: BlogContentProps) {
  const { t, language } = useTranslation();
  const filteredPosts = posts.filter((p) => p.language === language);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <h1 className={styles.title}>{t('blog.title')}</h1>
          <p className={styles.subtitle}>{t('blog.subtitle')}</p>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.inner}>
          {filteredPosts.length === 0 ? (
            <p className={styles.empty}>{t('blog.noPosts')}</p>
          ) : (
            <div className={styles.grid}>
              {filteredPosts.map((post) => (
                <article key={post.slug} className={styles.card}>
                  <div className={styles.cardCover} aria-hidden="true">
                    <div className={styles.coverGradient} />
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.tags}>
                      {post.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className={styles.tag}>
                          <Tag size={10} aria-hidden="true" />
                          {tag}
                        </span>
                      ))}
                    </div>
                    <h2 className={styles.cardTitle}>
                      <Link href={`/blog/${post.slug}`} className={styles.cardTitleLink}>
                        {post.title}
                      </Link>
                    </h2>
                    <p className={styles.cardDesc}>{post.description}</p>
                    <div className={styles.cardFooter}>
                      <div className={styles.meta}>
                        <time className={styles.date} dateTime={post.date}>
                          {formatDate(post.date, language)}
                        </time>
                        <span className={styles.author}>{post.author}</span>
                      </div>
                      <Link
                        href={`/blog/${post.slug}`}
                        className={styles.readMore}
                        aria-label={`Read ${post.title}`}
                      >
                        {t('blog.readMore')}
                        <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
