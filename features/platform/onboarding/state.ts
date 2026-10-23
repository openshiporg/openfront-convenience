export type OnboardingActionState = {
  message: string | null;
  success: boolean;
  /** The submitted values, so a failed attempt keeps what was typed. */
  values: Record<string, string>;
  attempt: number;
};

export const initialOnboardingState: OnboardingActionState = {
  message: null,
  success: false,
  values: {},
  attempt: 0,
};
