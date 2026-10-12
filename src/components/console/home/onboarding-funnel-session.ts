const DISMISS_KEY = 'onboarding-funnel-dismissed';

export function onboardingDismissed() {
  return sessionStorage.getItem(DISMISS_KEY) === '1';
}

export function rememberOnboardingDismiss() {
  sessionStorage.setItem(DISMISS_KEY, '1');
}
