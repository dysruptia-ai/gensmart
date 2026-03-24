'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, usePathname } from 'next/navigation';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import Button from '@/components/ui/Button';
import type { TourStepConfig } from './tourSteps';
import styles from './OnboardingTour.module.css';

const TOOLTIP_GAP = 12;

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getTooltipStyle(
  targetRect: TargetRect,
  position: TourStepConfig['position'],
  tooltipWidth: number,
  tooltipHeight: number
): React.CSSProperties {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const effectivePosition = isMobile ? 'bottom' : position;

  let top = 0;
  let left = 0;

  switch (effectivePosition) {
    case 'bottom':
      top = targetRect.top + targetRect.height + TOOLTIP_GAP;
      left = targetRect.left;
      break;
    case 'top':
      top = targetRect.top - tooltipHeight - TOOLTIP_GAP;
      left = targetRect.left;
      break;
    case 'left':
      top = targetRect.top;
      left = targetRect.left - tooltipWidth - TOOLTIP_GAP;
      break;
    case 'right':
      top = targetRect.top;
      left = targetRect.left + targetRect.width + TOOLTIP_GAP;
      break;
  }

  // Clamp to viewport
  const maxLeft = window.innerWidth - tooltipWidth - 16;
  const maxTop = window.innerHeight - tooltipHeight - 16;
  left = Math.max(16, Math.min(left, maxLeft));
  top = Math.max(16, Math.min(top, maxTop));

  return { top, left };
}

function getArrowClass(position: TourStepConfig['position']): string {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const effectivePosition = isMobile ? 'bottom' : position;

  switch (effectivePosition) {
    case 'bottom':
      return styles.arrowBottom;
    case 'top':
      return styles.arrowTop;
    case 'left':
      return styles.arrowLeft;
    case 'right':
      return styles.arrowRight;
    default:
      return styles.arrowBottom;
  }
}

interface OnboardingTourProps {
  steps: TourStepConfig[];
  onComplete: () => void;
  onStepChange?: (step: number) => void;
  initialStep?: number;
}

export default function OnboardingTour({ steps, onComplete, onStepChange, initialStep = 0 }: OnboardingTourProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();

  const [currentStep, setCurrentStep] = useState(initialStep);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  // Find and track the target element
  const updateTargetRect = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.targetSelector);
    if (el) {
      const rect = el.getBoundingClientRect();
      const padding = step.spotlightPadding ?? 8;
      setTargetRect({
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      });
      setIsNavigating(false);
    } else {
      setTargetRect(null);
    }
  }, [step]);

  // Navigate to step route if needed, then find target
  useEffect(() => {
    if (!step) return;

    if (step.route && !pathname.startsWith(step.route)) {
      setIsNavigating(true);
      setTargetRect(null);
      router.push(step.route);
      return;
    }

    // Click a prerequisite element (e.g., tab switch) before looking for target
    if (step.clickBeforeSelector) {
      const clickTarget = document.querySelector(step.clickBeforeSelector) as HTMLElement | null;
      if (clickTarget) {
        clickTarget.click();
      }
    }

    // Poll for element to appear (after tab switch or lazy render)
    let attempts = 0;
    const maxAttempts = 20;
    const interval = setInterval(() => {
      const el = document.querySelector(step.targetSelector);
      if (el || attempts >= maxAttempts) {
        clearInterval(interval);
        updateTargetRect();
      }
      attempts++;
    }, 150);

    return () => clearInterval(interval);
  }, [step, pathname, router, updateTargetRect]);

  // Watch for resize/scroll
  useEffect(() => {
    if (!step) return;

    const el = document.querySelector(step.targetSelector);
    if (el) {
      resizeObserverRef.current = new ResizeObserver(() => updateTargetRect());
      resizeObserverRef.current.observe(el);
    }

    const handleResize = () => updateTargetRect();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      resizeObserverRef.current?.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [step, updateTargetRect]);

  // Elevate target element above spotlight so it's clickable
  useEffect(() => {
    if (!step || !targetRect) return;
    const el = document.querySelector(step.targetSelector) as HTMLElement | null;
    if (!el) return;

    const originalPosition = el.style.position;
    const originalZIndex = el.style.zIndex;
    const originalPointerEvents = el.style.pointerEvents;

    el.style.position = 'relative';
    el.style.zIndex = '10001';
    el.style.pointerEvents = 'auto';

    return () => {
      el.style.position = originalPosition;
      el.style.zIndex = originalZIndex;
      el.style.pointerEvents = originalPointerEvents;
    };
  }, [step, targetRect]);

  // Keyboard: Escape to skip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onComplete();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goNext() {
    if (isLastStep) {
      onComplete();
      return;
    }
    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);
    setTargetRect(null);
    onStepChange?.(nextStep);
  }

  function goBack() {
    if (isFirstStep) return;
    const prevStep = currentStep - 1;
    setCurrentStep(prevStep);
    setTargetRect(null);
    onStepChange?.(prevStep);
  }

  if (!step) return null;

  const tooltipContent = (
    <div role="dialog" aria-modal="true" aria-label={t(step.title)}>
      <div className={styles.stepCounter}>
        {t('onboarding.stepOf', { current: String(currentStep + 1), total: String(steps.length) })}
      </div>

      <div className={styles.progress}>
        {steps.map((_, i) => (
          <div
            key={i}
            className={[
              styles.dot,
              i === currentStep ? styles.dotActive : '',
              i < currentStep ? styles.dotCompleted : '',
            ].filter(Boolean).join(' ')}
          />
        ))}
      </div>

      <h3 className={styles.title}>{t(step.title)}</h3>
      <p className={styles.description}>{t(step.description)}</p>

      <div className={styles.actions}>
        <button className={styles.skipBtn} onClick={() => onComplete()}>
          {t('onboarding.skipTour')}
        </button>
        <div className={styles.actionsRight}>
          {!isFirstStep && (
            <Button variant="secondary" size="sm" icon={ChevronLeft} onClick={goBack}>
              {t('onboarding.back')}
            </Button>
          )}
          <Button
            size="sm"
            icon={isLastStep ? undefined : ChevronRight}
            onClick={goNext}
          >
            {isLastStep ? t('onboarding.finish') : t('onboarding.next')}
          </Button>
        </div>
      </div>
    </div>
  );

  // If target not found (navigating or missing), show centered fallback
  if (!targetRect || isNavigating) {
    return createPortal(
      <>
        <div className={styles.fallbackBackdrop} />
        <div className={styles.fallbackTooltip} ref={tooltipRef}>
          {tooltipContent}
        </div>
      </>,
      document.body
    );
  }

  const tooltipEl = tooltipRef.current;
  const tooltipWidth = tooltipEl?.offsetWidth ?? 340;
  const tooltipHeight = tooltipEl?.offsetHeight ?? 250;
  const tooltipStyle = getTooltipStyle(targetRect, step.position, tooltipWidth, tooltipHeight);
  const arrowClass = getArrowClass(step.position);

  return createPortal(
    <>
      {/* Spotlight — creates dark overlay via box-shadow, pointer-events: none */}
      <div
        className={styles.spotlight}
        style={{
          top: targetRect.top,
          left: targetRect.left,
          width: targetRect.width,
          height: targetRect.height,
        }}
      />

      {/* Tooltip — fully interactive */}
      <div
        className={styles.tooltip}
        ref={tooltipRef}
        style={tooltipStyle}
      >
        <div className={`${styles.tooltipArrow} ${arrowClass}`} />
        {tooltipContent}
      </div>
    </>,
    document.body
  );
}
