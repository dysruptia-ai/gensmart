import type { ElementType } from 'react';
import { Globe, Mail } from 'lucide-react';
import { FaWhatsapp, FaTelegram, FaInstagram, FaFacebookMessenger } from 'react-icons/fa6';

export type ConversationChannel = 'web' | 'whatsapp' | 'telegram' | 'email' | 'instagram' | 'facebook' | 'messenger';

export interface ChannelMeta {
  icon: ElementType;
  label: string;
  /** Color del canal en la Bandeja (token de gs-tokens.css). */
  color: string;
}

const MESSENGER: ChannelMeta = { icon: FaFacebookMessenger, label: 'Messenger', color: 'var(--app-ch-messenger)' };

/** Same icons as the agent editor so channels look identical across the dashboard. 'facebook' is the stored value for Messenger. */
export const CHANNEL_META: Record<ConversationChannel, ChannelMeta> = {
  web: { icon: Globe, label: 'Web', color: 'var(--app-ch-web)' },
  whatsapp: { icon: FaWhatsapp, label: 'WhatsApp', color: 'var(--app-ch-whatsapp)' },
  telegram: { icon: FaTelegram, label: 'Telegram', color: 'var(--app-ch-telegram)' },
  email: { icon: Mail, label: 'Email', color: 'var(--app-ch-email)' },
  instagram: { icon: FaInstagram, label: 'Instagram', color: 'var(--app-ch-instagram)' },
  facebook: MESSENGER,
  messenger: MESSENGER,
};

export function getChannelMeta(channel: string): ChannelMeta {
  return CHANNEL_META[channel as ConversationChannel] ?? { icon: Globe, label: channel, color: 'var(--app-ch-web)' };
}
