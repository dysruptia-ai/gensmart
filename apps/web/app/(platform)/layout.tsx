import type { Metadata } from 'next';
import { inter, handjet } from '@/app/fonts/platform';
import { sora, geist } from '@/app/fonts/site';
import '@/app/fonts/fallbacks.css';
import './platform.css';
import './gs-tokens.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ToastProvider } from '@/components/ui/Toast';
import { APP_BOOT_SCRIPT } from '@/lib/app-theme';

// La plataforma no se indexa ni se comparte: sin descripción de marketing, openGraph ni twitter
export const metadata: Metadata = {
  metadataBase: new URL('https://www.gensmart.co'),
  title: {
    default: 'GenSmart',
    template: '%s | GenSmart',
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // `lang` y `data-gs-theme` los ajusta APP_BOOT_SCRIPT antes del primer pintado (y luego
    // LanguageProvider): por eso <html> no se compara al hidratar.
    <html
      lang="en"
      className={`${inter.variable} ${handjet.variable} ${sora.variable} ${geist.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: APP_BOOT_SCRIPT }} />
      </head>
      <body>
        <AuthProvider>
          <LanguageProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
