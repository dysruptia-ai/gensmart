/**
 * Datos de la página de Contacto. Sin `'use client'`: la página arma con esto
 * las migas y el JSON-LD en el servidor, y los componentes pintan lo mismo.
 */
import type { Crumb } from '../Breadcrumbs/crumbs';

export const CONTACT_CRUMBS: readonly Crumb[] = [
  { id: 'home', labelKey: 'site.crumbs.home' },
  { id: 'contact', labelKey: 'site.crumbs.contact' },
];

/** Variantes por `?tipo=` (design/web/contacto.html, atributo `data-tipos`). */
export const CONTACT_VARIANTS = ['partner', 'directorio', 'recomendacion', 'comunidad'] as const;
export type ContactVariant = (typeof CONTACT_VARIANTS)[number];

/** Valor del campo `type` del envío: la variante, o `demo` en la versión base. */
export type ContactFormType = ContactVariant | 'demo';

export function isContactVariant(value: string | null): value is ContactVariant {
  return value !== null && (CONTACT_VARIANTS as readonly string[]).includes(value);
}

/** Puntos de la columna de texto (3 en todas las variantes). */
export const CONTACT_CHECK_COUNT = 3;
/** Pasos de "Qué pasa cuando envías el formulario". */
export const CONTACT_NEXT_COUNT = 3;
