import SiteNotFound from '@/components/site/NotFound/SiteNotFound';
import NotFoundTitle from '@/components/site/NotFound/NotFoundTitle';

/** `notFound()` en una página del sitio: la misma 404, con su `<title>` y `noindex`. */
export default function SiteNotFoundBoundary() {
  return (
    <>
      <NotFoundTitle />
      <SiteNotFound />
    </>
  );
}
