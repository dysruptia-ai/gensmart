import { Fragment, type ReactNode } from 'react';

interface RichTextProps {
  /** Texto de i18n: `**negrita**` y saltos de línea (`\n`). Nada más se interpreta. */
  text: string;
  className?: string;
}

/** Marcado mínimo y seguro para textos de i18n: arma nodos React, nunca HTML crudo. */
export default function RichText({ text, className }: RichTextProps) {
  const lines = text.split('\n');
  const nodes: ReactNode[] = lines.map((line, li) => (
    <Fragment key={li}>
      {li > 0 ? <br /> : null}
      {line.split('**').map((part, pi) => (pi % 2 === 1 ? <b key={pi}>{part}</b> : part))}
    </Fragment>
  ));
  return className ? <span className={className}>{nodes}</span> : <>{nodes}</>;
}
