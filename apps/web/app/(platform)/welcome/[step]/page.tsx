'use client';

import { notFound, useParams } from 'next/navigation';
import { WelcomeDone, WelcomeStep, parseWelcomeStep } from '@/components/welcome';

/** `/welcome/1` a `/welcome/5` y `/welcome/done`: el paso va en la URL para que "Atrás" del navegador funcione. */
export default function WelcomeStepPage() {
  const params = useParams<{ step: string }>();
  const step = parseWelcomeStep(String(params.step));
  if (step === null) notFound();
  if (step === 'done') return <WelcomeDone />;
  return <WelcomeStep key={step} step={step} />;
}
