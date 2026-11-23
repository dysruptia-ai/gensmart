import type { Metadata } from 'next';
import Link from 'next/link';
import { Sora, Geist } from 'next/font/google';
import styles from './global-not-found.module.css';

const sora = Sora({ subsets: ['latin'], weight: ['600'], display: 'swap', variable: '--font-sora' });
const geist = Geist({ subsets: ['latin'], weight: ['400', '600'], display: 'swap', variable: '--font-geist' });

export const metadata: Metadata = {
  title: '404 | GenSmart',
  robots: { index: false, follow: true },
};

/** 404 para URL que no coinciden con ninguna ruta (hay dos layouts raíz). Bilingüe: no sabemos el idioma. */
export default function GlobalNotFound() {
  return (
    <html lang="es" className={`${sora.variable} ${geist.variable}`}>
      <body className={styles.body}>
        <main className={styles.main}>
          <p className={styles.code}>404</p>
          <h1 className={styles.title}>Esta página no existe</h1>
          <p className={styles.text} lang="en">
            This page does not exist.
          </p>
          <nav className={styles.links} aria-label="GenSmart">
            <Link href="/" hrefLang="es" lang="es" className={styles.primary}>
              Ir al inicio
            </Link>
            <Link href="/en" hrefLang="en" lang="en" className={styles.secondary}>
              Go to home
            </Link>
          </nav>
        </main>
      </body>
    </html>
  );
}
