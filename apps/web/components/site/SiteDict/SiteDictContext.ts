'use client';

import { createContext } from 'react';

/** Diccionario del sitio (`i18n/site/<lang>.json`) del idioma de la página. Lo ponen `SiteDictEs` / `SiteDictEn`. */
export const SiteDictContext = createContext<unknown>(null);
