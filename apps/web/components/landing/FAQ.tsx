'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './FAQ.module.css';

interface FAQItem {
  questionKey: string;
  answerKey: string;
}

const FAQ_ITEMS: FAQItem[] = [
  { questionKey: 'pricing.faq.q1', answerKey: 'pricing.faq.a1' },
  { questionKey: 'pricing.faq.q2', answerKey: 'pricing.faq.a2' },
  { questionKey: 'pricing.faq.q3', answerKey: 'pricing.faq.a3' },
  { questionKey: 'pricing.faq.q4', answerKey: 'pricing.faq.a4' },
];

interface FAQItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}

function FAQItemComponent({ question, answer, isOpen, onToggle }: FAQItemProps) {
  return (
    <div className={`${styles.item} ${isOpen ? styles.open : ''}`}>
      <button
        className={styles.question}
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span>{question}</span>
        <ChevronDown
          size={20}
          className={styles.chevron}
          aria-hidden="true"
        />
      </button>
      <div className={styles.answerWrap} aria-hidden={!isOpen}>
        <p className={styles.answer}>{answer}</p>
      </div>
    </div>
  );
}

export function FAQ() {
  const { t } = useTranslation();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) => {
    setOpenIndex((prev) => (prev === i ? null : i));
  };

  return (
    <section className={styles.section} aria-label="Frequently asked questions">
      <div className={styles.inner}>
        <ScrollReveal>
          <div className={styles.header}>
            <h2 className={styles.title}>{t('landing.faq.title')}</h2>
            <p className={styles.subtitle}>{t('landing.faq.subtitle')}</p>
          </div>
        </ScrollReveal>

        <div className={styles.list} role="list">
          {FAQ_ITEMS.map((item, i) => (
            <ScrollReveal key={item.questionKey} delay={i * 40}>
              <FAQItemComponent
                question={t(item.questionKey)}
                answer={t(item.answerKey)}
                isOpen={openIndex === i}
                onToggle={() => toggle(i)}
              />
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
