"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onboardConvenienceBusinessAction } from "../actions";
import { initialOnboardingState } from "../state";

// Family dialog/card orchestration; dependency-safe phases stay in the existing
// authorized atomic Keystone command, rather than exposing public raw seed CRUD.
export function useOnboardingApi(onSuccess?: () => void) {
  const router = useRouter();
  const [state, action, pending] = useActionState(onboardConvenienceBusinessAction, initialOnboardingState);
  const [idempotencyKey] = useState(() => `onboard-${crypto.randomUUID()}`);
  useEffect(() => {
    if (state.success) {
      onSuccess?.();
      router.replace("/dashboard");
      router.refresh();
    }
  }, [onSuccess, router, state.success]);
  // A new key per attempt: a corrected retry is a different request.
  return { state, action, pending, idempotencyKey: `${idempotencyKey}-${state.attempt}` };
}
