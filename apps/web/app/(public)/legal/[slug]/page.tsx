import type { Metadata } from 'next';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import { notFound } from 'next/navigation';
import styles from './legal.module.css';

const LEGAL_DIR = path.join(process.cwd(), 'content', 'legal');

const LEGAL_SLUGS = ['privacy-policy', 'terms-of-service', 'cookie-policy'];

function getLegalPage(slug: string) {
  const filePath = path.join(LEGAL_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  const html = marked(content) as string;

  return {
    title: (data['title'] as string) || slug,
    description: (data['description'] as string) || '',
    lastUpdated: (data['lastUpdated'] as string) || '',
    html,
  };
}

export function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getLegalPage(slug);
  if (!page) return {};
  return {
    title: `${page.title} — GenSmart`,
    description: page.description,
  };
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!LEGAL_SLUGS.includes(slug)) notFound();

  const page = getLegalPage(slug);
  if (!page) notFound();

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div
          className={styles.content}
          dangerouslySetInnerHTML={{ __html: page.html }}
        />
      </div>
    </div>
  );
}
