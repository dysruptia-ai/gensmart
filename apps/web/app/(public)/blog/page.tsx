import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Tag } from 'lucide-react';
import { getAllPosts } from '@/lib/blog';
import styles from './blog.module.css';

export const metadata: Metadata = {
  title: 'Blog — GenSmart',
  description:
    'Insights on AI agents, WhatsApp automation, CRM, and business growth from the GenSmart team.',
  openGraph: {
    title: 'Blog — GenSmart',
    description:
      'Insights on AI agents, WhatsApp automation, CRM, and business growth.',
    url: 'https://gensmart.ai/blog',
    siteName: 'GenSmart',
    type: 'website',
  },
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <h1 className={styles.title}>GenSmart Blog</h1>
          <p className={styles.subtitle}>
            Insights on AI agents, automation, and growth
          </p>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.inner}>
          {posts.length === 0 ? (
            <p className={styles.empty}>No posts yet. Check back soon!</p>
          ) : (
            <div className={styles.grid}>
              {posts.map((post) => (
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
                      <Link
                        href={`/blog/${post.slug}`}
                        className={styles.cardTitleLink}
                      >
                        {post.title}
                      </Link>
                    </h2>
                    <p className={styles.cardDesc}>{post.description}</p>
                    <div className={styles.cardFooter}>
                      <div className={styles.meta}>
                        <time
                          className={styles.date}
                          dateTime={post.date}
                        >
                          {new Date(post.date).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </time>
                        <span className={styles.author}>{post.author}</span>
                      </div>
                      <Link
                        href={`/blog/${post.slug}`}
                        className={styles.readMore}
                        aria-label={`Read ${post.title}`}
                      >
                        Read more
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
