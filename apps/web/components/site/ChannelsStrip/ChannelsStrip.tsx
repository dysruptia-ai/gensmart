'use client';

import Image from 'next/image';
import { Globe, Mail } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './ChannelsStrip.module.css';

interface LogoChannel {
  name: string;
  logo: string;
}

/** Canales con logo de marca; correo y sitio web van con icono y texto traducido. */
const LOGO_CHANNELS: LogoChannel[] = [
  { name: 'WhatsApp', logo: '/site/img/logos/whatsapp.svg' },
  { name: 'Instagram', logo: '/site/img/logos/instagram.svg' },
  { name: 'Messenger', logo: '/site/img/logos/messenger.svg' },
  { name: 'Telegram', logo: '/site/img/logos/telegram.svg' },
];

interface ChannelsStripProps {
  /** Nombre accesible de la lista. */
  label: string;
  align?: 'center' | 'start';
  className?: string;
}

/** Fila de los seis canales (hero del home, Producto y subpáginas). */
export default function ChannelsStrip({ label, align = 'center', className }: ChannelsStripProps) {
  const { t } = useTranslation();
  const classes = [styles.channels, align === 'start' ? styles.start : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <ul className={classes} aria-label={label}>
      {LOGO_CHANNELS.map((c) => (
        <li key={c.name} className={styles.channel}>
          <Image src={c.logo} alt="" width={19} height={19} unoptimized className={styles.logo} />
          {c.name}
        </li>
      ))}
      <li className={styles.channel}>
        <Mail size={21} aria-hidden="true" className={styles.icon} />
        {t('site.channels.email')}
      </li>
      <li className={styles.channel}>
        <Globe size={21} aria-hidden="true" className={styles.icon} />
        {t('site.channels.website')}
      </li>
    </ul>
  );
}
