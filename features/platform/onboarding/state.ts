export type OnboardingActionState = {
  message: string | null;
  success: boolean;
};

export const initialOnboardingState: OnboardingActionState = {
  message: null,
  success: false,
};
