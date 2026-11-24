import Container from '@/components/site/Container';
import PageHero from '@/components/site/PageHero';
import Section from '@/components/site/Section';
import SiteButton from '@/components/site/SiteButton';
import type { BlogPost } from '@/lib/blog';
import { siteT } from '@/lib/site-i18n';
import type { SiteLanguage } from '@/lib/site-routes';
import BlogLayout from './BlogLayout';
import BlogSidebar from './BlogSidebar';
import NewsletterBand from './NewsletterBand';
import PathBox from './PathBox';
import PostCard from './PostCard';
import PostCover from './PostCover';
import { categoryCrumbs, formatPostDate, relatedPosts } from './blogContent';
import styles from './BlogPostPage.module.css';

interface BlogPostPageProps {
  post: BlogPost;
  lang: SiteLanguage;
}

/** Artículo del blog (design/web: `postPage`). */
export default function BlogPostPage({ post, lang }: BlogPostPageProps) {
  const t = siteT(lang);
  const related = relatedPosts(post, lang);
  return (
    <>
      <PageHero
        className={styles.hero}
        crumbs={categoryCrumbs(post.category, t)}
        linkLastCrumb
        eyebrow={t(`site.blog.categories.${post.category}.name`)}
        title={{ before: post.title }}
        lead={post.description}
        actions={
          <div className={styles.meta}>
            <div className={styles.byline}>
              <span className={styles.avatar} aria-hidden="true">
                GS
              </span>
              <span className={styles.who}>{t('site.blog.post.by')}</span>
              <span className={styles.sep} aria-hidden="true" />
              <time dateTime={post.date}>{formatPostDate(post.date, lang)}</time>
              <span className={styles.sep} aria-hidden="true" />
              <span>{t('site.blog.minRead', { n: post.read })}</span>
            </div>
            {post.updated !== post.date ? (
              <small className={styles.updated}>
                {t('site.blog.post.updated')} <time dateTime={post.updated}>{formatPostDate(post.updated, lang)}</time>
              </small>
            ) : null}
          </div>
        }
        aside={<PostCover post={post} priority sizes="(max-width: 980px) 100vw, 560px" className={styles.cover} />}
      />

      <BlogLayout
        sidebar={<BlogSidebar lang={lang} toc={post.headings} category={post.category} postId={post.id} />}
      >
        <article className={styles.prose}>
          <PathBox post={post} lang={lang} />
          <div dangerouslySetInnerHTML={{ __html: post.htmlBefore }} />
          <aside className={styles.cta} aria-labelledby="post-cta-h">
            <h2 id="post-cta-h" className={styles.ctaTitle}>
              {t('site.blog.post.ctaTitle')}
            </h2>
            <p>{t('site.blog.post.ctaText')}</p>
            <div className={styles.ctaActions}>
              <SiteButton to="register">{t('site.blog.post.ctaTrial')}</SiteButton>
              <SiteButton to="contact" variant="ghost">
                {t('site.blog.post.ctaDemo')}
              </SiteButton>
            </div>
          </aside>
          <div dangerouslySetInnerHTML={{ __html: post.htmlAfter }} />
          <div className={styles.pathEnd}>
            <PathBox post={post} lang={lang} />
          </div>
        </article>
      </BlogLayout>

      <Section surface="alt" rhythm="m">
        <Container>
          <p className={styles.kicker}>{t('site.blog.post.keepReading')}</p>
          <h2 className={styles.relatedTitle}>{t('site.blog.post.related')}</h2>
          <div className={styles.related}>
            {related.map((p) => (
              <PostCard key={p.id} post={p} lang={lang} />
            ))}
          </div>
        </Container>
      </Section>

      <NewsletterBand />
    </>
  );
}
