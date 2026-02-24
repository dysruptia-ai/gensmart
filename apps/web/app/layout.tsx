import type { Metadata } from 'next';
import { Inter, Handjet } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/components/ui/Toast';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-family',
});

const handjet = Handjet({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-logo',
});

export const metadata: Metadata = {
  title: 'GenSmart — AI Agents for Business',
  description: 'Create and deploy AI conversational agents for WhatsApp and Web in minutes.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${handjet.variable}`}>
      <body>
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
