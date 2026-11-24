import RichText from '@/components/site/RichText';
import { siteT } from '@/lib/site-i18n';
import type { SiteLanguage } from '@/lib/site-routes';
import type { DocBlock } from './docsData';
import { DocChapters, DocVideo, DocVideoProvider } from './DocVideo';
import styles from './DocProse.module.css';

interface DocProseProps {
  body: readonly DocBlock[];
  lang: SiteLanguage;
}

const LIST_CLASS = { plain: styles.plain, check: styles.check, fix: styles.fix } as const;

/** Cuerpo de una guía (design/web: `docProse`): todo el texto en el HTML del servidor. */
export default function DocProse({ body, lang }: DocProseProps) {
  const t = siteT(lang);
  return (
    <DocVideoProvider>
      <div className={styles.prose}>
        {body.map((block, i) => {
          switch (block.kind) {
            case 'p':
              return (
                <p key={i}>
                  <RichText text={block.text[lang]} />
                </p>
              );
            case 'h2':
              return (
                <h2 key={i} id={block.id[lang]}>
                  {block.text[lang]}
                </h2>
              );
            case 'note':
              return (
                <aside key={i} className={styles.note} aria-label={t('site.docs.guide.note')}>
                  <span className={styles.noteTag} aria-hidden="true">
                    {t('site.docs.guide.noteTag')}
                  </span>
                  <p>
                    <RichText text={block.text[lang]} />
                  </p>
                </aside>
              );
            case 'steps':
              return (
                <ol key={i} className={styles.steps}>
                  {block.items.map((item, j) => (
                    <li key={j}>
                      <div>
                        <RichText text={item[lang]} />
                      </div>
                    </li>
                  ))}
                </ol>
              );
            case 'list':
              return (
                <ul key={i} className={LIST_CLASS[block.variant]}>
                  {block.items.map((item, j) => (
                    <li key={j}>
                      <RichText text={item[lang]} />
                    </li>
                  ))}
                </ul>
              );
            case 'video':
              return (
                <DocVideo key={i} videoId={block.videoId} title={block.title[lang]} caption={block.caption[lang]} />
              );
            case 'chapters':
              return (
                <DocChapters
                  key={i}
                  videoId={block.videoId}
                  items={block.items.map((item) => ({ start: item.start, title: item.title[lang] }))}
                />
              );
          }
        })}
      </div>
    </DocVideoProvider>
  );
}
