import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

export interface BlogPostMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  tags: string[];
  cover_image: string;
  language: string;
}

export interface BlogPost extends BlogPostMeta {
  content: string;
  html: string;
}

function ensureBlogDir() {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'));
}

export function getAllPosts(): BlogPostMeta[] {
  const files = ensureBlogDir();

  const posts = files.map((filename) => {
    const slug = filename.replace(/\.md$/, '');
    const filePath = path.join(BLOG_DIR, filename);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { data } = matter(raw);

    return {
      slug,
      title: data['title'] ?? slug,
      description: data['description'] ?? '',
      date: data['date'] ?? '',
      author: data['author'] ?? 'GenSmart Team',
      tags: Array.isArray(data['tags']) ? data['tags'] : [],
      cover_image: data['cover_image'] ?? '/blog/cover-placeholder.svg',
      language: data['language'] ?? 'en',
    } satisfies BlogPostMeta;
  });

  return posts.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function getPostBySlug(slug: string): BlogPost | null {
  const filePath = path.join(BLOG_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);

  // Configure marked for safe rendering
  marked.setOptions({ gfm: true, breaks: true });

  const html = marked(content) as string;

  return {
    slug,
    title: data['title'] ?? slug,
    description: data['description'] ?? '',
    date: data['date'] ?? '',
    author: data['author'] ?? 'GenSmart Team',
    tags: Array.isArray(data['tags']) ? data['tags'] : [],
    cover_image: data['cover_image'] ?? '/blog/cover-placeholder.svg',
    language: data['language'] ?? 'en',
    content,
    html,
  };
}

export function getAllTags(): string[] {
  const posts = getAllPosts();
  const tagSet = new Set<string>();
  posts.forEach((p) => p.tags.forEach((t) => tagSet.add(t)));
  return Array.from(tagSet).sort();
}

export function getAllSlugs(): string[] {
  const files = ensureBlogDir();
  return files.map((f) => f.replace(/\.md$/, ''));
}
