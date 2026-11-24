'use client';

import ContactHero from './ContactHero/ContactHero';
import ContactFormSection from './ContactFormSection/ContactFormSection';
import useContactVariant from './useContactVariant';

/** Hero y formulario comparten la variante de `?tipo=` (se aplica en el cliente). */
export default function ContactContent() {
  const variant = useContactVariant();
  return (
    <>
      <ContactHero variant={variant} />
      <ContactFormSection variant={variant} />
    </>
  );
}
