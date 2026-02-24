'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import styles from './PublicNavbar.module.css';

export function PublicNavbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    setMobileOpen(false);
  };

  return (
    <header className={`${styles.navbar} ${isScrolled ? styles.scrolled : ''}`}>
      <div className={styles.inner}>
        <Logo size="lg" variant="full" color="primary" href="/" />

        <nav className={styles.navLinks} aria-label="Main navigation">
          <button
            className={styles.navLink}
            onClick={() => scrollTo('features')}
          >
            Features
          </button>
          <Link className={styles.navLink} href="/pricing">
            Pricing
          </Link>
          <Link className={styles.navLink} href="/blog">
            Blog
          </Link>
        </nav>

        <div className={styles.actions}>
          <Link href="/login" className={styles.loginBtn}>
            Log In
          </Link>
          <Link href="/register" className={styles.ctaBtn}>
            Start Free
          </Link>
        </div>

        <button
          className={styles.hamburger}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle mobile menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <div
        className={`${styles.mobileMenu} ${mobileOpen ? styles.open : ''}`}
        aria-hidden={!mobileOpen}
      >
        <nav className={styles.mobileNav} aria-label="Mobile navigation">
          <button
            className={styles.mobileLink}
            onClick={() => scrollTo('features')}
          >
            Features
          </button>
          <Link
            className={styles.mobileLink}
            href="/pricing"
            onClick={() => setMobileOpen(false)}
          >
            Pricing
          </Link>
          <Link
            className={styles.mobileLink}
            href="/blog"
            onClick={() => setMobileOpen(false)}
          >
            Blog
          </Link>
        </nav>
        <div className={styles.mobileActions}>
          <Link
            href="/login"
            className={styles.loginBtn}
            onClick={() => setMobileOpen(false)}
          >
            Log In
          </Link>
          <Link
            href="/register"
            className={styles.ctaBtn}
            onClick={() => setMobileOpen(false)}
          >
            Start Free
          </Link>
        </div>
      </div>
    </header>
  );
}
