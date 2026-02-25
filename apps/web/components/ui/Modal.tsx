'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import styles from './Modal.module.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, size = 'md', children }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const wasOpenRef = useRef(false);

  // Keep onClose ref current without triggering effect re-runs
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    // Only focus the modal when it first opens, not on every re-render
    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      const raf = requestAnimationFrame(() => {
        modalRef.current?.focus();
      });
      return () => {
        cancelAnimationFrame(raf);
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
      };
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCloseRef.current();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        ref={modalRef}
        className={[styles.modal, styles[size]].join(' ')}
        tabIndex={-1}
      >
        {title && (
          <div className={styles.header}>
            <h2 id="modal-title" className={styles.title}>{title}</h2>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => onCloseRef.current()}
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div className={styles.body}>{children}</div>
      </div>
    </div>,
    document.body
  );
}
