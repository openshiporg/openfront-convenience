"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DEFAULT_STORE_LOGO_COLOR,
  DEFAULT_STORE_LOGO_ICON,
} from "../../store-settings/lib/store-logo";
import { OnboardingForm } from "../OnboardingForm";

interface OnboardingDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OnboardingDialog({
  isOpen,
  onClose,
}: OnboardingDialogProps) {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby={undefined} className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-5 py-6 text-left sm:px-8">
          <div
            aria-hidden="true"
            className="mb-2 flex size-11 items-center justify-center rounded-xl bg-muted p-2 shadow-[inset_0_1px_2px_rgb(0_0_0/0.06)] [&>svg]:block [&>svg]:size-full"
            style={{ filter: `hue-rotate(${DEFAULT_STORE_LOGO_COLOR}deg)` }}
            dangerouslySetInnerHTML={{ __html: DEFAULT_STORE_LOGO_ICON }}
          />
          <DialogTitle>Set up your first store</DialogTitle>
        </DialogHeader>
        <div className="px-5 py-6 sm:px-8 sm:py-8">
          <OnboardingForm onSuccess={onClose} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default OnboardingDialog;
