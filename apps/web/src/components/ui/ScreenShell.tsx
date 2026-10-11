import Link from 'next/link';
import type { ReactNode } from 'react';

interface ScreenShellProps {
  children: ReactNode;
  /** Shows a "Back" link to this path above the content. */
  back?: string;
}

export function ScreenShell({ children, back }: ScreenShellProps) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      {back ? (
        <Link href={back} className="back-link">
          Back
        </Link>
      ) : null}
      {children}
    </main>
  );
}
