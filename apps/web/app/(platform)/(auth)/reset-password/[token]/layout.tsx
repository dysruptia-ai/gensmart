import type { Metadata } from 'next';

// El título en el idioma activo lo pone la página (useAuthScreen); este es el del servidor
export const metadata: Metadata = {
  title: 'New password',
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
