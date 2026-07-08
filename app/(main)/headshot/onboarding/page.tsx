import { Suspense } from 'react';
import { OnboardingFlow } from '../components/onboarding-flow';

// Public page — accessible without auth. It is the front door of the headshot
// funnel: email entry -> magic-link verification -> biometric consent.
export default function HeadshotOnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingFlow />
    </Suspense>
  );
}
