import type { Metadata } from 'next';
import AuthShell from '@/components/auth/AuthShell/AuthShell';

// Pantallas de acceso: fuera del índice, pero sus enlaces (legales, ayuda) se siguen
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
