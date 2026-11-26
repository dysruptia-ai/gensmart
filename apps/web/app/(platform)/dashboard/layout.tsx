import type { Metadata } from 'next';
import AppShell from '@/components/app/AppShell/AppShell';

// El título real de cada pestaña lo pone el shell en el idioma activo ("Hoy | GenSmart")
export const metadata: Metadata = {
  title: { absolute: 'GenSmart' },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
