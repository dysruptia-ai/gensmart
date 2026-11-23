import { Fragment } from 'react';

interface MarkedTextProps {
  /** Texto con marcas `[[dato|n]]`: el dato se resalta y lleva su número. */
  text: string;
}

/**
 * Resalta en un mensaje los datos que el agente anota en la ficha.
 * El número es decorativo (`aria-hidden`): la relación se entiende por el texto de la ficha.
 */
export default function MarkedText({ text }: MarkedTextProps) {
  const parts = text.split(/\[\[([^|\]]+)\|(\d+)\]\]/);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 3 === 0) return <Fragment key={i}>{part}</Fragment>;
        if (i % 3 === 2) return null;
        return (
          <mark key={i}>
            {part}
            <sup aria-hidden="true">{parts[i + 1]}</sup>
          </mark>
        );
      })}
    </>
  );
}
