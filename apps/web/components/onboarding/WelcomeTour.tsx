'use client';

import { useAuth } from '@/contexts/AuthContext';
import OnboardingTour from './OnboardingTour';
import { WELCOME_TOUR_STEPS } from './tourSteps';

export default function WelcomeTour() {
  const { user, updateOnboarding } = useAuth();

  if (!user || user.onboardingCompleted) return null;

  return (
    <OnboardingTour
      steps={WELCOME_TOUR_STEPS}
      initialStep={user.onboardingStep}
      onComplete={() => void updateOnboarding(undefined, true)}
      onStepChange={(step) => void updateOnboarding(step)}
    />
  );
}
