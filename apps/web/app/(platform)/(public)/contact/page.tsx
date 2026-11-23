import type { Metadata } from 'next';
import styles from './contact.module.css';

export const metadata: Metadata = {
  title: 'Contact — GenSmart',
  description: 'Get in touch with the GenSmart team.',
};

export default function ContactPage() {
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.title}>Contact Us</h1>
        <p className={styles.coming}>Coming soon.</p>
        <p className={styles.desc}>
          Our contact form is on its way. For now, email us directly at{' '}
          <a href="mailto:hello@gensmart.co" className={styles.link}>
            hello@gensmart.co
          </a>{' '}
          or reach sales at{' '}
          <a href="mailto:sales@gensmart.co" className={styles.link}>
            sales@gensmart.co
          </a>
          .
        </p>
      </div>
    </div>
  );
}
