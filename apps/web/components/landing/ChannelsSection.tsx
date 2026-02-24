import { MessageCircle, Globe } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';
import styles from './ChannelsSection.module.css';

export function ChannelsSection() {
  return (
    <section className={styles.section} aria-label="Channels">
      <div className={styles.inner}>
        <ScrollReveal>
          <div className={styles.header}>
            <span className={styles.eyebrow}>Multi-channel deployment</span>
            <h2 className={styles.title}>Meet Your Customers Where They Are</h2>
            <p className={styles.subtitle}>
              Deploy the same AI agent across WhatsApp and your website
              simultaneously — from a single dashboard.
            </p>
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
                  <p className={styles.channelDesc}>
                    Connect via Meta Cloud API. Reach 2B+ WhatsApp users instantly.
                  </p>
                </div>
              </div>

              {/* WhatsApp chat mockup */}
              <div className={styles.mockup + ' ' + styles.whatsappMockup}>
                <div className={styles.waHeader}>
                  <div className={styles.waAvatar}>S</div>
                  <div>
                    <div className={styles.waName}>Sales Bot</div>
                    <div className={styles.waOnline}>Online</div>
                  </div>
                </div>
                <div className={styles.waMessages}>
                  <div className={styles.waMsg + ' ' + styles.waContact}>
                    Hola! Me interesa conocer sus servicios
                    <span className={styles.waTime}>10:23</span>
                  </div>
                  <div className={styles.waMsg + ' ' + styles.waOwn}>
                    ¡Hola! Con gusto te ayudo. ¿Cuál es tu empresa y qué necesitas?
                    <span className={styles.waTime}>10:23</span>
                  </div>
                  <div className={styles.waMsg + ' ' + styles.waContact}>
                    Somos TechFlow, necesitamos automatizar ventas
                    <span className={styles.waTime}>10:24</span>
                  </div>
                  <div className={styles.waTyping}>
                    <span /><span /><span />
                  </div>
                </div>
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
                  <p className={styles.channelDesc}>
                    Embed with one line of code. Customizable to match your brand.
                  </p>
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
