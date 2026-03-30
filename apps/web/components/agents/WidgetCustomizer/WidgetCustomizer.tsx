'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Copy, Check, MessageSquare, Globe } from 'lucide-react';
import ColorPicker from '@/components/ui/ColorPicker';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import styles from './WidgetCustomizer.module.css';

interface WebConfig {
  primary_color: string;
  welcome_message: string;
  bubble_text: string;
  position: 'bottom-right' | 'bottom-left';
}

interface WidgetCustomizerProps {
  agentId: string;
  initialConfig: WebConfig;
  channels: string[];
  onChange?: (config: WebConfig) => void;
  onSaved?: (config: WebConfig) => void;
}

const DEFAULT_CONFIG: WebConfig = {
  primary_color: '#25D366',
  welcome_message: 'Hello! How can I help you?',
  bubble_text: 'Chat with us',
  position: 'bottom-right',
};

export default function WidgetCustomizer({ agentId, initialConfig, onChange }: WidgetCustomizerProps) {
  const { success, error: toastError } = useToast();

  const [config, setConfig] = useState<WebConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig,
  });
  const [copied, setCopied] = useState(false);

  const latestConfigRef = useRef(config);

  const update = useCallback(<K extends keyof WebConfig>(key: K, value: WebConfig[K]) => {
    setConfig((prev) => {
      const next = { ...prev, [key]: value };
      latestConfigRef.current = next;
      return next;
    });
  }, []);

  // Notify parent of config changes (deferred to avoid setState-during-render)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    onChange?.(config);
  }, [config, onChange]);

  const snippetCode = `<script src="${process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://app.gensmart.co'}/widget.js" data-agent-id="${agentId}"></script>`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(snippetCode);
      setCopied(true);
      success('Snippet copied to clipboard');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toastError('Failed to copy to clipboard');
    }
  }

  const previewPos = config.position === 'bottom-left' ? styles.previewLeft : styles.previewRight;

  return (
    <div className={styles.wrapper}>
      <div className={styles.columns}>
        {/* Settings column */}
        <div className={styles.settings}>
          <div className={styles.sectionTitle}>Web Widget</div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Primary Color</label>
            <ColorPicker
              value={config.primary_color}
              onChange={(c) => update('primary_color', c)}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Welcome Message</label>
            <Input
              value={config.welcome_message}
              onChange={(e) => update('welcome_message', e.target.value)}
              placeholder="Hello! How can I help you?"
              maxLength={200}
            />
            <span className={styles.hint}>{config.welcome_message.length}/200 characters</span>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Bubble Text</label>
            <Input
              value={config.bubble_text}
              onChange={(e) => update('bubble_text', e.target.value)}
              placeholder="Chat with us"
              maxLength={60}
            />
            <span className={styles.hint}>Shown in the floating bubble button</span>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Position</label>
            <select
              className={styles.select}
              value={config.position}
              onChange={(e) => update('position', e.target.value as 'bottom-right' | 'bottom-left')}
            >
              <option value="bottom-right">Bottom Right</option>
              <option value="bottom-left">Bottom Left</option>
            </select>
          </div>

        </div>

        {/* Preview column */}
        <div className={styles.previewCol}>
          <div className={styles.sectionTitle}>Preview</div>
          <div className={styles.previewBrowser}>
            <div className={styles.previewBar}>
              <span className={styles.previewBarDot} />
              <span className={styles.previewBarDot} />
              <span className={styles.previewBarDot} />
              <span className={styles.previewBarUrl}><Globe size={10} />example.com</span>
            </div>
            <div className={styles.previewPage}>
              {/* Simulated webpage content */}
              <div className={styles.previewContent}>
                <div className={styles.previewLine} />
                <div className={styles.previewLine} style={{ width: '75%' }} />
                <div className={styles.previewLine} style={{ width: '60%' }} />
              </div>

              {/* Widget bubble preview */}
              <div className={[styles.previewBubble, previewPos].join(' ')}
                style={{ backgroundColor: config.primary_color }}
              >
                <MessageSquare size={18} color="#fff" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Embed code */}
      <div className={styles.snippetSection}>
        <div className={styles.sectionTitle}>Embed Code</div>
        <p className={styles.snippetDesc}>
          Add this snippet to the <code>&lt;head&gt;</code> or before the closing <code>&lt;/body&gt;</code> tag of your website.
        </p>
        <div className={styles.snippetBox}>
          <code className={styles.snippetCode}>{snippetCode}</code>
          <button
            className={styles.copyBtn}
            onClick={handleCopy}
            type="button"
            aria-label="Copy embed code"
          >
            {copied ? <Check size={15} color="var(--color-success)" /> : <Copy size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}
