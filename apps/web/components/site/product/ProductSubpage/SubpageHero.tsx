import type { ReactNode } from 'react';
import type { SiteLinkKey } from '@/lib/site-links';
import PageHero from '../../PageHero';
import SiteButton from '../../SiteButton';
import { subpageCrumbs, type ProductSubpageId } from './subpageData';

interface SubpageHeroProps {
  id: ProductSubpageId;
  title: { before: string; accent?: string; after?: string };
  lead: string;
  /** Texto del botón de registro (sin código promocional). */
  primary: string;
  /** Enlace secundario a la subpágina vecina. */
  secondary: { to: SiteLinkKey; label: string };
  /** Maqueta a todo el ancho, debajo del texto. */
  mock: ReactNode;
}

/** Hero de las subpáginas de Producto: migas, `h1`, lead, dos botones y la maqueta. */
export default function SubpageHero({ id, title, lead, primary, secondary, mock }: SubpageHeroProps) {
  return (
    <PageHero
      size="feature"
      crumbs={subpageCrumbs(id)}
      title={title}
      lead={lead}
      actions={
        <>
          <SiteButton to="register" size="lg">
            {primary}
          </SiteButton>
          <SiteButton to={secondary.to} variant="ghost" size="lg">
            {secondary.label}
          </SiteButton>
        </>
      }
      below={mock}
    />
  );
}
