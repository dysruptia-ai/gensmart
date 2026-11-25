import type { Metadata } from 'next';

// El título en el idioma activo lo pone la página (useAuthScreen); este es el del servidor
export const metadata: Metadata = {
  title: 'Sign in',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
