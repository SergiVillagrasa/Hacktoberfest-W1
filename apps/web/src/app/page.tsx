import Image from 'next/image';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <h1 className="text-center text-[2.5rem] leading-none text-grape">SnapHunt</h1>

      <div className="panel flex flex-1 items-center justify-center overflow-hidden">
        <Image src="/mascot/idle.webp" alt="Your host: a friendly pug in a red bow tie" width={1024} height={1024} priority className="h-auto w-full max-w-sm" />
      </div>

      <div className="flex flex-col gap-4">
        <Link href="/create" className="chunky">
          Create a room
        </Link>
        <Link href="/join" className="chunky chunky-secondary">
          Join with a code
        </Link>
        <p className="text-center text-base text-ink-soft">2-6 friends. One phone each.</p>
      </div>
    </main>
  );
}
