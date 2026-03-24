'use client';

import { useAuth } from '@/contexts/AuthContext';
import OnboardingTour from './OnboardingTour';
import { EDITOR_TOUR_STEPS } from './tourSteps';

export default function EditorTour() {
  const { user, updateOnboarding } = useAuth();

  // Only show if welcome tour is done AND editor tour is NOT done
  if (!user || !user.onboardingCompleted || user.editorTourCompleted) return null;

  return (
    <OnboardingTour
      steps={EDITOR_TOUR_STEPS}
      onComplete={() => void updateOnboarding(undefined, undefined, true)}
    />
  );
}
