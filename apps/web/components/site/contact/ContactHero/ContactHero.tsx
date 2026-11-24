'use client';

import { useTranslation } from '@/hooks/useTranslation';
import PageHero from '../../PageHero';
import { CONTACT_CRUMBS, type ContactVariant } from '../contactData';

const H = 'site.contact.hero';

interface ContactHeroProps {
  variant: ContactVariant | null;
}

/** Hero de Contacto: versión base (demo) desde el servidor; la variante de `?tipo=` cambia h1 y lead. */
export default function ContactHero({ variant }: ContactHeroProps) {
  const { t } = useTranslation();
  if (variant) {
    const V = `site.contact.tipos.${variant}`;
    return <PageHero crumbs={CONTACT_CRUMBS} title={{ before: t(`${V}.h1`) }} lead={t(`${V}.lead`)} />;
  }
  return (
    <PageHero
      crumbs={CONTACT_CRUMBS}
      title={{ before: t(`${H}.titleBefore`), accent: t(`${H}.titleAccent`), after: t(`${H}.titleAfter`) }}
      lead={t(`${H}.lead`)}
    />
  );
}
