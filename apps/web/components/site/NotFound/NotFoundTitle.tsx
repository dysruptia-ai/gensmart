'use client';

import { useTranslation } from '@/hooks/useTranslation';

/** `<title>` y `robots` de la 404 del sitio (React los sube al `<head>`). */
export default function NotFoundTitle() {
  const { t } = useTranslation();
  return (
    <>
      <title>{t('site.notFound.title')}</title>
      <meta name="robots" content="noindex, follow" />
    </>
  );
}
