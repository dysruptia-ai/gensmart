import type { ElementType } from 'react';
import { Globe, Mail } from 'lucide-react';
import { FaWhatsapp, FaTelegram, FaInstagram, FaFacebookMessenger } from 'react-icons/fa6';

export type ConversationChannel = 'web' | 'whatsapp' | 'telegram' | 'email' | 'instagram' | 'facebook' | 'messenger';

export interface ChannelMeta {
  icon: ElementType;
  label: string;
}

const MESSENGER: ChannelMeta = { icon: FaFacebookMessenger, label: 'Messenger' };

/** Same icons as the agent editor so channels look identical across the dashboard. 'facebook' is the stored value for Messenger. */
export const CHANNEL_META: Record<ConversationChannel, ChannelMeta> = {
  web: { icon: Globe, label: 'Web' },
  whatsapp: { icon: FaWhatsapp, label: 'WhatsApp' },
  telegram: { icon: FaTelegram, label: 'Telegram' },
  email: { icon: Mail, label: 'Email' },
  instagram: { icon: FaInstagram, label: 'Instagram' },
  facebook: MESSENGER,
  messenger: MESSENGER,
};

export function getChannelMeta(channel: string): ChannelMeta {
  return CHANNEL_META[channel as ConversationChannel] ?? { icon: Globe, label: channel };
}
