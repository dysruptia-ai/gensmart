import React from 'react';
import Link from 'next/link';
import { appButtonClass, type AppButtonStyleOptions } from './AppButton';

export interface AppButtonLinkProps extends Omit<AppButtonStyleOptions, 'loading'> {
  href: string;
  children: React.ReactNode;
}

/** Enlace con el aspecto de `AppButton` (para navegar, no para acciones). */
export default function AppButtonLink({ href, children, ...style }: AppButtonLinkProps) {
  return (
    <Link href={href} className={appButtonClass(style)}>
      {children}
    </Link>
  );
}
