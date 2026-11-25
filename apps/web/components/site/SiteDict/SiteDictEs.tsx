'use client';

import type { ReactNode } from 'react';
import dict from '@/i18n/site/es.json';
import { SiteDictContext } from './SiteDictContext';

/** Pone solo el diccionario en español en el contexto: el otro idioma no entra en el bundle. */
export default function SiteDictEs({ children }: { children: ReactNode }) {
  return <SiteDictContext.Provider value={dict}>{children}</SiteDictContext.Provider>;
}
