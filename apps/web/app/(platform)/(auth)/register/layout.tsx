import type { Metadata } from 'next';

// El título en el idioma activo lo pone la página (useAuthScreen); este es el del servidor
export const metadata: Metadata = {
  title: 'Create your account',
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
