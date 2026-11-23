import type { ReactNode } from 'react';
import { cx } from './cx';

/** Clases de página del diseño: deciden qué reglas de `ProductSubpage.module.css` aplican. */
export type SubpageVariant = 'isAgents' | 'isInbox' | 'isCrm' | 'isDay';

interface ProductSubpageProps {
  variants: readonly SubpageVariant[];
  children: ReactNode;
}

/** Contenedor de una subpágina de Producto (design: `.is-agents`, `.is-inbox`…). */
export default function ProductSubpage({ variants, children }: ProductSubpageProps) {
  return <div className={cx('page', ...variants)}>{children}</div>;
}
