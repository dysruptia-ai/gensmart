'use client';

import { useEffect, useState } from 'react';
import { isContactVariant, type ContactVariant } from './contactData';

/**
 * Variante de la URL, leída en el cliente después de montar: el HTML del servidor
 * (página estática) siempre trae la versión base, y la variante se aplica al hidratar.
 */
export default function useContactVariant(): ContactVariant | null {
  const [variant, setVariant] = useState<ContactVariant | null>(null);
  useEffect(() => {
    const tipo = new URLSearchParams(window.location.search).get('tipo');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la URL solo existe en el cliente
    if (isContactVariant(tipo)) setVariant(tipo);
  }, []);
  return variant;
}
