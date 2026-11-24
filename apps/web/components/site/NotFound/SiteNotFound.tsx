import SiteRoot from '../SiteRoot';
import SkipLink from '../SkipLink';
import SiteHeader from '../SiteHeader';
import SiteFooter from '../SiteFooter';
import NotFoundContent from './NotFoundContent';

/** 404 dentro del sitio: cabecera, contenido de la plantilla `nf` y pie. */
export default function SiteNotFound() {
  return (
    <SiteRoot>
      <SkipLink />
      <SiteHeader />
      <main id="main">
        <NotFoundContent />
      </main>
      <SiteFooter />
    </SiteRoot>
  );
}
