import type { Metadata } from 'next';
import { getAllPosts } from '@/lib/blog';
import BlogContent from './BlogContent';

export const metadata: Metadata = {
  title: 'Blog — GenSmart',
  description:
    'Insights on AI agents, WhatsApp automation, CRM, and business growth from the GenSmart team.',
  openGraph: {
    title: 'Blog — GenSmart',
    description:
      'Insights on AI agents, WhatsApp automation, CRM, and business growth.',
    url: 'https://www.gensmart.co/blog',
    siteName: 'GenSmart',
    type: 'website',
  },
};

export default function BlogPage() {
  const posts = getAllPosts();
  return <BlogContent posts={posts} />;
}
