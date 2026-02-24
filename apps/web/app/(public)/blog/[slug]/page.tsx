import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Tag, Calendar, User } from 'lucide-react';
import { getPostBySlug, getAllSlugs } from '@/lib/blog';
import styles from './post.module.css';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  return {
    title: `${post.title} — GenSmart Blog`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      url: `https://gensmart.ai/blog/${slug}`,
      siteName: 'GenSmart',
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
      images: [
        {
          url: 'https://gensmart.ai/og-image.png',
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
    },
    alternates: {
      canonical: `https://gensmart.ai/blog/${slug}`,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) notFound();

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: {
      '@type': 'Person',
      name: post.author,
    },
    publisher: {
      '@type': 'Organization',
      name: 'GenSmart',
      url: 'https://gensmart.ai',
    },
    url: `https://gensmart.ai/blog/${slug}`,
  };

  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <div className={styles.inner}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/blog" className={styles.backLink}>
            <ArrowLeft size={16} aria-hidden="true" />
            Back to Blog
          </Link>
        </nav>

        <article className={styles.article}>
          {/* Post header */}
          <header className={styles.postHeader}>
            <div className={styles.tags}>
              {post.tags.map((tag) => (
                <span key={tag} className={styles.tag}>
                  <Tag size={10} aria-hidden="true" />
                  {tag}
                </span>
              ))}
            </div>

            <h1 className={styles.title}>{post.title}</h1>
            <p className={styles.description}>{post.description}</p>

            <div className={styles.meta}>
              <span className={styles.metaItem}>
                <Calendar size={14} aria-hidden="true" />
                <time dateTime={post.date}>
                  {new Date(post.date).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </time>
              </span>
              <span className={styles.metaDivider} aria-hidden="true">·</span>
              <span className={styles.metaItem}>
                <User size={14} aria-hidden="true" />
                {post.author}
              </span>
            </div>
          </header>

          {/* Post content */}
          <div
            className={styles.content}
            dangerouslySetInnerHTML={{ __html: post.html }}
          />
        </article>

        {/* Back link */}
        <div className={styles.postFooter}>
          <Link href="/blog" className={styles.backLink}>
            <ArrowLeft size={16} aria-hidden="true" />
            Back to Blog
          </Link>
        </div>
      </div>
    </div>
  );
}
