'use client';

import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import type { SiteLanguage } from '@/lib/site-routes';

/*
 * Cada provider es un chunk aparte (`import()`): Turbopack junta en un chunk todos los
 * componentes cliente que importa el layout, así que con imports estáticos los dos
 * idiomas viajarían juntos. Con `next/dynamic` se renderiza en el servidor y el HTML
 * solo pide el chunk del idioma de la página.
 */
const SiteDictEs = dynamic(() => import('./SiteDictEs'));
const SiteDictEn = dynamic(() => import('./SiteDictEn'));

/** Pone en el contexto el diccionario del idioma de la página (uno solo). */
export default function SiteDict({ lang, children }: { lang: SiteLanguage; children: ReactNode }) {
  return lang === 'en' ? <SiteDictEn>{children}</SiteDictEn> : <SiteDictEs>{children}</SiteDictEs>;
}
