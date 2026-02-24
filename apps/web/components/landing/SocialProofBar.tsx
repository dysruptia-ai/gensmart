import styles from './SocialProofBar.module.css';

const LOGOS = [
  'TechFlow',
  'GrowthLab',
  'AutoScale',
  'LeadGenius',
  'SmartReach',
  'ScaleUp',
];

export function SocialProofBar() {
  return (
    <section className={styles.section} aria-label="Social proof">
      <div className={styles.inner}>
        <p className={styles.text}>
          Trusted by <strong>500+</strong> businesses worldwide
        </p>
        <div className={styles.logoTrack} aria-hidden="true">
          <div className={styles.logoList}>
            {[...LOGOS, ...LOGOS].map((name, i) => (
              <div key={i} className={styles.logoItem}>
                {name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
