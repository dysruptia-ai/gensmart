'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { firstUnansweredStep, useWelcome } from '@/components/welcome';

/** `/welcome`: retoma en el primer paso sin responder. */
export default function WelcomeIndexPage() {
  const router = useRouter();
  const { answers, stepHref } = useWelcome();
  useEffect(() => {
    router.replace(stepHref(firstUnansweredStep(answers)));
    // Solo al entrar: las respuestas ya están cargadas (WelcomeScreen espera a `ready`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
