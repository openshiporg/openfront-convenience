'use client';

import { Button } from '@/components/ui/button';
import { ArrowLeft, Lock, LogOut, Store } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signOut } from '@/features/dashboard/actions/auth';

export function NoAccessPage() {
  const router = useRouter();

  return (
    <main className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm flex flex-col items-center bg-muted/40 border rounded-lg p-6 shadow-lg">
        <div className="flex justify-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/10 border-2 border-rose-200 dark:border-rose-800">
            <Lock className="h-6 w-6 text-rose-600 dark:text-rose-400" />
          </div>
        </div>

        <div className="text-center gap-0 mt-4">
          <h1 className="text-center text-lg font-semibold">This area is for store staff</h1>
          <p className="mt-2 text-center mx-auto sm:max-w-[90%] text-sm text-muted-foreground">
            You are signed in with a customer account. Your orders, receipts and points are in your account on the shop. Staff: ask the owner to add you to the team.
          </p>
        </div>

        <div className="flex flex-col gap-2 w-full mt-8">
          <Button variant="default" className="h-11 w-full" onClick={() => router.push('/account')}>
            <Store className="size-4" />
            Go to my account
          </Button>
          <Button variant="outline" className="h-11 w-full" onClick={() => router.push('/')}>
            <ArrowLeft className="size-4" />
            Back to the shop
          </Button>
        </div>
        <form action={signOut} className="w-full mt-2">
          <Button type="submit" variant="ghost" className="h-11 w-full">
            <LogOut className="size-3" />
            Sign out
          </Button>
        </form>
      </div>
    </main>
  );
}

export default NoAccessPage;