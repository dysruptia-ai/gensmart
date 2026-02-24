import Avatar from '@/components/ui/Avatar';
import { ScrollReveal } from './ScrollReveal';
import styles from './TestimonialsSection.module.css';

const TESTIMONIALS = [
  {
    name: 'Sarah Chen',
    role: 'Marketing Director',
    company: 'TechFlow',
    quote:
      'GenSmart replaced our entire N8N setup. We deployed 5 agents in one afternoon and leads went through the roof.',
  },
  {
    name: 'Carlos Mendoza',
    role: 'CEO',
    company: 'GrowthLab',
    quote:
      'The AI scoring alone has increased our conversion rate by 40%. Game changer for our sales team.',
  },
  {
    name: 'Emma Williams',
    role: 'Freelance Consultant',
    company: 'Independent',
    quote:
      'I went from zero automation to a fully working WhatsApp bot in 15 minutes. My clients are blown away.',
  },
];

export function TestimonialsSection() {
  return (
    <section className={styles.section} aria-label="Testimonials">
      <div className={styles.inner}>
        <ScrollReveal>
          <div className={styles.header}>
            <span className={styles.eyebrow}>What our users say</span>
            <h2 className={styles.title}>Loved by Businesses Worldwide</h2>
          </div>
        </ScrollReveal>

        <div className={styles.grid}>
          {TESTIMONIALS.map(({ name, role, company, quote }, i) => (
            <ScrollReveal key={name} delay={i * 100}>
              <blockquote className={styles.card}>
                <p className={styles.quote}>&ldquo;{quote}&rdquo;</p>
                <footer className={styles.author}>
                  <Avatar name={name} size="md" />
                  <div className={styles.authorInfo}>
                    <cite className={styles.authorName}>{name}</cite>
                    <span className={styles.authorRole}>
                      {role} at {company}
                    </span>
                  </div>
                </footer>
              </blockquote>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
