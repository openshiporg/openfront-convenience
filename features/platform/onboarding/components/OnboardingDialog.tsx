"use client";

import { Store } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
          <div className="mb-2 flex size-10 items-center justify-center border bg-muted">
            <Store aria-hidden="true" className="size-5" />
          </div>
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
