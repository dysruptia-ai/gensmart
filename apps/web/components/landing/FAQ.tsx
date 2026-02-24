'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';
import styles from './FAQ.module.css';

const FAQ_ITEMS = [
  {
    question: 'What is GenSmart?',
    answer:
      'GenSmart is an all-in-one platform for creating and deploying AI conversational agents on WhatsApp and the web. It includes a built-in CRM, sales funnel, scheduling, and knowledge base — no coding required.',
  },
  {
    question: 'Do I need coding skills?',
    answer:
      'Not at all. GenSmart is designed for business owners, marketers, and freelancers. You can build and deploy fully functional AI agents using our visual editor and pre-built templates.',
  },
  {
    question: 'How does WhatsApp integration work?',
    answer:
      'We use the official Meta Cloud API. You can connect your WhatsApp Business account through our guided Embedded Signup flow in minutes — no technical knowledge needed.',
  },
  {
    question: 'What AI models are available?',
    answer:
      'Free and Starter plans use GPT-4o-mini and Claude Haiku for cost efficiency. Pro and Enterprise plans unlock all models including GPT-4o and Claude Sonnet. Enterprise users can also bring their own API keys.',
  },
  {
    question: 'Can I try it for free?',
    answer:
      'Yes! Our Free plan gives you 1 agent, 50 messages/month, and 25 contacts with no credit card required. It\'s free forever — upgrade only when you\'re ready.',
  },
  {
    question: 'How does AI lead scoring work?',
    answer:
      'After each conversation, our AI analyzes the interaction and assigns a score from 0-10 based on intent signals, engagement, and captured information. High-score leads are automatically highlighted in your CRM.',
  },
  {
    question: 'What is Human Takeover?',
    answer:
      'When a conversation needs a human touch, you can take over from the dashboard (or mobile app) with one click. The AI pauses, you chat directly, then release control and the agent picks up seamlessly.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'Absolutely. We use AES-256 encryption for sensitive data, bcrypt for passwords, PostgreSQL Row Level Security for multi-tenant isolation, and all API communications use TLS. We are GDPR compliant.',
  },
  {
    question: 'Can I bring my own API key?',
    answer:
      'Enterprise plan users can provide their own OpenAI or Anthropic API keys. This removes message limits — you only pay GenSmart for the platform, and your AI costs go directly to the provider.',
  },
  {
    question: 'What happens if I exceed my message limit?',
    answer:
      'We\'ll notify you at 80% of your limit via email and in-app notification. At 100%, your agents pause until you upgrade, purchase a message add-on, or your monthly limit resets on the 1st.',
  },
];

interface FAQItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}

function FAQItem({ question, answer, isOpen, onToggle }: FAQItemProps) {
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
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) => {
    setOpenIndex((prev) => (prev === i ? null : i));
  };

  return (
    <section className={styles.section} aria-label="Frequently asked questions">
      <div className={styles.inner}>
        <ScrollReveal>
          <div className={styles.header}>
            <h2 className={styles.title}>Frequently Asked Questions</h2>
            <p className={styles.subtitle}>
              Everything you need to know about GenSmart.
            </p>
          </div>
        </ScrollReveal>

        <div className={styles.list} role="list">
          {FAQ_ITEMS.map((item, i) => (
            <ScrollReveal key={item.question} delay={i * 40}>
              <FAQItem
                question={item.question}
                answer={item.answer}
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
