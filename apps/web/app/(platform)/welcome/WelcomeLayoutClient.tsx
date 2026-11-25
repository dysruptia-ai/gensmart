'use client';

import React, { Suspense } from 'react';
import { AuthShell } from '@/components/auth';
import { WelcomePanel, WelcomeProvider, WelcomeScreen } from '@/components/welcome';

/** Layout de acceso de web-36 con el panel del cuestionario; el estado vive aquí entre pasos. */
export default function WelcomeLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <WelcomeProvider>
        <AuthShell welcomePanel={<WelcomePanel />}>
          <WelcomeScreen>{children}</WelcomeScreen>
        </AuthShell>
      </WelcomeProvider>
    </Suspense>
  );
}
