import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import styles from './legal.module.css';

const LEGAL_PAGES: Record<string, { title: string; description: string }> = {
  'privacy-policy': {
    title: 'Privacy Policy',
    description: 'How we collect, use, and protect your data.',
  },
  'terms-of-service': {
    title: 'Terms of Service',
    description: 'The terms and conditions governing your use of GenSmart.',
  },
  'cookie-policy': {
    title: 'Cookie Policy',
    description: 'How we use cookies and similar tracking technologies.',
  },
};

export function generateStaticParams() {
  return Object.keys(LEGAL_PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = LEGAL_PAGES[slug];
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
  const page = LEGAL_PAGES[slug];
  if (!page) notFound();

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.title}>{page.title}</h1>
        <p className={styles.coming}>This page is coming soon.</p>
        <p className={styles.desc}>
          We&apos;re working on our {page.title.toLowerCase()}. Please check
          back shortly or contact us at{' '}
          <a href="mailto:legal@gensmart.co" className={styles.link}>
            legal@gensmart.co
          </a>{' '}
          if you have any questions.
        </p>
      </div>
    </div>
  );
}
