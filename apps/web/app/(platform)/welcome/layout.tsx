import type { Metadata } from 'next';
import WelcomeLayoutClient from './WelcomeLayoutClient';

// Cuestionario de bienvenida: fuera del índice. El título en el idioma activo lo pone cada paso.
export const metadata: Metadata = {
  title: 'Welcome',
  robots: { index: false, follow: false },
};

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return <WelcomeLayoutClient>{children}</WelcomeLayoutClient>;
}
