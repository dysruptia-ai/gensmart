import Image from 'next/image';
import type { BlogPostMeta } from '@/lib/blog';
import styles from './PostCover.module.css';

interface PostCoverProps {
  post: Pick<BlogPostMeta, 'cover'>;
  /** `sizes` de la imagen según dónde va la tarjeta. */
  sizes: string;
  /** Portada del artículo: es el LCP de la página. */
  priority?: boolean;
  className?: string;
}

/**
 * Portada del artículo (design/web: `.cover.cover-img`), 1200×900. Decorativa (`alt=""`):
 * el título siempre está al lado, en el `h3` de la tarjeta o en el `h1` del artículo.
 */
export default function PostCover({ post, sizes, priority = false, className }: PostCoverProps) {
  return (
    <div className={[styles.cover, className].filter(Boolean).join(' ')}>
      <Image src={post.cover} alt="" width={1200} height={900} sizes={sizes} priority={priority} />
    </div>
  );
}
