import Image from 'next/image';
import { Globe, Mail } from 'lucide-react';
import { cx } from './cx';

export type MockChannel = 'whatsapp' | 'instagram' | 'messenger' | 'telegram' | 'email' | 'web';

/** Los seis canales, en el orden del diseño. */
export const MOCK_CHANNELS: readonly MockChannel[] = [
  'whatsapp',
  'instagram',
  'messenger',
  'telegram',
  'email',
  'web',
];

export const CHANNEL_NAMES: Record<Exclude<MockChannel, 'email' | 'web'>, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  messenger: 'Messenger',
  telegram: 'Telegram',
};

interface ChannelIconProps {
  channel: MockChannel;
}

/** Ficha cuadrada con el logo de un canal (design: `.logo-tile.ch`). Decorativa. */
export default function ChannelIcon({ channel }: ChannelIconProps) {
  const own = channel === 'email' || channel === 'web';
  return (
    <span className={cx('logo-tile', 'ch', own && 'ch-own')} aria-hidden="true">
      {channel === 'email' ? (
        <Mail strokeWidth={1.9} />
      ) : channel === 'web' ? (
        <Globe strokeWidth={1.9} />
      ) : (
        <Image src={`/site/img/logos/${channel}.svg`} alt="" width={18} height={18} unoptimized />
      )}
    </span>
  );
}
