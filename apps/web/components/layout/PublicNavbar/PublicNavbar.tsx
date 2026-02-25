'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, X, LayoutDashboard } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { useAuth } from '@/contexts/AuthContext';
import styles from './PublicNavbar.module.css';

const SECTION_LINKS = [
  { label: 'Features', sectionId: 'features' },
  { label: 'How It Works', sectionId: 'how-it-works' },
];

export function PublicNavbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Blurs any focused element then closes mobile menu (prevents aria-hidden focus warning)
  const closeMobile = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setMobileOpen(false);
  }, []);

  // Navigate to a landing page section — smooth scroll if on '/', router.push otherwise
  const handleSectionClick = useCallback(
    (sectionId: string) => {
      closeMobile();
      if (pathname === '/') {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      } else {
        router.push(`/#${sectionId}`);
      }
    },
    [closeMobile, pathname, router]
  );

  return (
    <header className={`${styles.navbar} ${isScrolled ? styles.scrolled : ''}`}>
      <div className={styles.inner}>
        <Logo size="xl" variant="full" color="primary" href="/" />

        <nav className={styles.navLinks} aria-label="Main navigation">
          {SECTION_LINKS.map((link) => (
            <button
              key={link.sectionId}
              className={styles.navLink}
              onClick={() => handleSectionClick(link.sectionId)}
            >
              {link.label}
            </button>
          ))}
          <Link className={styles.navLink} href="/pricing">
            Pricing
          </Link>
          <Link className={styles.navLink} href="/blog">
            Blog
          </Link>
        </nav>

        <div className={styles.actions}>
          {isAuthenticated ? (
            <Link href="/dashboard" className={styles.ctaBtn}>
              <LayoutDashboard
                size={15}
                aria-hidden="true"
                style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.375rem' }}
              />
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className={styles.loginBtn}>
                Log In
              </Link>
              <Link href="/register" className={styles.ctaBtn}>
                Start Free
              </Link>
            </>
          )}
        </div>

        <button
          className={styles.hamburger}
          onClick={() => {
            if (mobileOpen) closeMobile();
            else setMobileOpen(true);
          }}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          aria-controls="public-mobile-nav"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <div
        id="public-mobile-nav"
        className={`${styles.mobileMenu} ${mobileOpen ? styles.open : ''}`}
        aria-hidden={!mobileOpen}
      >
        <nav className={styles.mobileNav} aria-label="Mobile navigation">
          {SECTION_LINKS.map((link) => (
            <button
              key={link.sectionId}
              className={styles.mobileLink}
              onClick={() => handleSectionClick(link.sectionId)}
            >
              {link.label}
            </button>
          ))}
          <Link className={styles.mobileLink} href="/pricing" onClick={closeMobile}>
            Pricing
          </Link>
          <Link className={styles.mobileLink} href="/blog" onClick={closeMobile}>
            Blog
          </Link>
        </nav>
        <div className={styles.mobileActions}>
          {isAuthenticated ? (
            <Link href="/dashboard" className={styles.ctaBtn} onClick={closeMobile}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className={styles.loginBtn} onClick={closeMobile}>
                Log In
              </Link>
              <Link href="/register" className={styles.ctaBtn} onClick={closeMobile}>
                Start Free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
