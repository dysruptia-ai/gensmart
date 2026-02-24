import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import styles from './FinalCTA.module.css';

export function FinalCTA() {
  return (
    <section className={styles.section} aria-label="Call to action">
      <div className={styles.inner}>
        <div className={styles.decorLeft} aria-hidden="true" />
        <div className={styles.decorRight} aria-hidden="true" />

        <div className={styles.content}>
          <h2 className={styles.title}>
            Ready to Deploy Your First AI Agent?
          </h2>
          <p className={styles.subtitle}>
            Join 500+ businesses already using GenSmart to automate conversations
            and capture more leads.
          </p>
          <div className={styles.actions}>
            <Link href="/register" className={styles.cta}>
              Start Free
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <p className={styles.hint}>No credit card required · Free forever plan</p>
          </div>
        </div>
      </div>
    </section>
  );
}
