'use client';

import type { ReactNode } from 'react';
import dict from '@/i18n/site/en.json';
import { SiteDictContext } from './SiteDictContext';

/** Pone solo el diccionario en inglés en el contexto: el otro idioma no entra en el bundle. */
export default function SiteDictEn({ children }: { children: ReactNode }) {
  return <SiteDictContext.Provider value={dict}>{children}</SiteDictContext.Provider>;
}
