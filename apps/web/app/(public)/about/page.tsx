import type { Metadata } from 'next';
import styles from './about.module.css';

export const metadata: Metadata = {
  title: 'About — GenSmart',
  description: 'Learn about the team and mission behind GenSmart.',
};

export default function AboutPage() {
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.title}>About GenSmart</h1>
        <p className={styles.coming}>Coming soon.</p>
        <p className={styles.desc}>
          We&apos;re putting the finishing touches on our About page. In the
          meantime, reach us at{' '}
          <a href="mailto:hello@gensmart.co" className={styles.link}>
            hello@gensmart.co
          </a>
          .
        </p>
      </div>
    </div>
  );
}
