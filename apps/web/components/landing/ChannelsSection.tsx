'use client';

import { useRef, useEffect, useState } from 'react';
import { MessageCircle, Globe } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './ChannelsSection.module.css';

export function ChannelsSection() {
  const { t } = useTranslation();
  const connectFlowRef = useRef<HTMLDivElement>(null);
  const [connectFlowVisible, setConnectFlowVisible] = useState(false);

  useEffect(() => {
    const el = connectFlowRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setConnectFlowVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className={styles.section} aria-label="Channels">
      <div className={styles.inner}>
        <ScrollReveal>
          <div className={styles.header}>
            <span className={styles.eyebrow}>{t('landing.channels.eyebrow')}</span>
            <h2 className={styles.title}>{t('landing.channels.title')}</h2>
            <p className={styles.subtitle}>{t('landing.channels.subtitle')}</p>
          </div>
        </ScrollReveal>

        <div className={styles.cards}>
          {/* WhatsApp card */}
          <ScrollReveal delay={100}>
            <div className={styles.channelCard}>
              <div className={styles.channelHeader}>
                <div className={styles.channelIcon + ' ' + styles.whatsappIcon}>
                  <MessageCircle size={24} aria-hidden="true" />
                </div>
                <div>
                  <h3 className={styles.channelTitle}>WhatsApp Business</h3>
                  <p className={styles.channelDesc}>{t('landing.channels.whatsappDesc')}</p>
                </div>
              </div>

              {/* Animated one-click connect flow */}
              <div
                ref={connectFlowRef}
                className={`${styles.mockup} ${styles.connectFlowMockup} ${connectFlowVisible ? styles.inView : ''}`}
              >
                <svg
                  width="100%"
                  viewBox="0 0 440 280"
                  xmlns="http://www.w3.org/2000/svg"
                  className={styles.connectFlowSvg}
                  aria-label="WhatsApp one-click connect flow: click, authorize, done"
                >
                  {/* Step 1 */}
                  <g className={styles.flowStep1}>
                    <rect x="20" y="30" width="120" height="90" rx="8" fill="#E6F1FB" stroke="#85B7EB" strokeWidth="0.5" />
                    <text x="80" y="58" textAnchor="middle" fontSize="12" fontWeight="500" fill="#0C447C">1. Click</text>
                    <text x="80" y="76" textAnchor="middle" fontSize="10" fill="#185FA5">&quot;Connect with</text>
                    <text x="80" y="90" textAnchor="middle" fontSize="10" fill="#185FA5">Facebook&quot;</text>
                  </g>
                  {/* Arrow 1 */}
                  <line className={styles.flowArrow1} x1="140" y1="75" x2="160" y2="75" stroke="#B4B2A9" strokeWidth="1.5" markerEnd="url(#wa-arrow)" />
                  {/* Step 2 */}
                  <g className={styles.flowStep2}>
                    <rect x="160" y="30" width="120" height="90" rx="8" fill="#EEEDFE" stroke="#AFA9EC" strokeWidth="0.5" />
                    <text x="220" y="58" textAnchor="middle" fontSize="12" fontWeight="500" fill="#3C3489">2. Authorize</text>
                    <text x="220" y="76" textAnchor="middle" fontSize="10" fill="#534AB7">Facebook popup,</text>
                    <text x="220" y="90" textAnchor="middle" fontSize="10" fill="#534AB7">select number</text>
                  </g>
                  {/* Arrow 2 */}
                  <line className={styles.flowArrow2} x1="280" y1="75" x2="300" y2="75" stroke="#B4B2A9" strokeWidth="1.5" markerEnd="url(#wa-arrow)" />
                  {/* Step 3 */}
                  <g className={styles.flowStep3}>
                    <rect x="300" y="30" width="120" height="90" rx="8" fill="#E1F5EE" stroke="#5DCAA5" strokeWidth="0.5" />
                    <text x="360" y="58" textAnchor="middle" fontSize="12" fontWeight="500" fill="#085041">3. Done!</text>
                    <text x="360" y="76" textAnchor="middle" fontSize="10" fill="#0F6E56">Agent is live</text>
                    <text x="360" y="90" textAnchor="middle" fontSize="10" fill="#0F6E56">on WhatsApp</text>
                  </g>
                  {/* Result badge */}
                  <g className={styles.flowResult}>
                    <rect x="80" y="160" width="280" height="50" rx="12" fill="#E1F5EE" stroke="#5DCAA5" strokeWidth="0.5" />
                    <circle cx="220" cy="185" r="12" fill="#1D9E75" className={styles.flowCheck} />
                    <path d="M214 185L218 189L226 181" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <text x="220" y="222" textAnchor="middle" fontSize="11" fontWeight="500" fill="#085041">Your agent is live on WhatsApp</text>
                  </g>
                  {/* Arrow marker */}
                  <defs>
                    <marker id="wa-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M2 1L8 5L2 9" fill="none" stroke="#B4B2A9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </marker>
                  </defs>
                </svg>
              </div>
            </div>
          </ScrollReveal>

          {/* Web Widget card */}
          <ScrollReveal delay={200}>
            <div className={styles.channelCard}>
              <div className={styles.channelHeader}>
                <div className={styles.channelIcon + ' ' + styles.webIcon}>
                  <Globe size={24} aria-hidden="true" />
                </div>
                <div>
                  <h3 className={styles.channelTitle}>Web Widget</h3>
                  <p className={styles.channelDesc}>{t('landing.channels.webDesc')}</p>
                </div>
              </div>

              {/* Web widget mockup */}
              <div className={styles.mockup + ' ' + styles.webMockup}>
                <div className={styles.widgetPanel}>
                  <div className={styles.widgetHeader}>
                    <div className={styles.widgetAvatar}>G</div>
                    <div>
                      <div className={styles.widgetName}>GenSmart Assistant</div>
                      <div className={styles.widgetStatus}>Typically replies instantly</div>
                    </div>
                  </div>
                  <div className={styles.widgetMessages}>
                    <div className={styles.widgetMsg + ' ' + styles.widgetBot}>
                      Hello! How can I help you today?
                    </div>
                    <div className={styles.widgetMsg + ' ' + styles.widgetUser}>
                      What are your pricing plans?
                    </div>
                    <div className={styles.widgetMsg + ' ' + styles.widgetBot}>
                      We offer 4 plans starting from Free. Our Pro plan at $79/mo is most popular!
                    </div>
                  </div>
                  <div className={styles.widgetInput}>
                    <span>Type a message...</span>
                  </div>
                </div>
                <div className={styles.widgetBubble} aria-hidden="true">
                  <MessageCircle size={20} />
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
