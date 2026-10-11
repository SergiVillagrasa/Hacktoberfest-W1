import { notFound } from 'next/navigation';
import { Mascot } from '@/components/mascot/Mascot';
import { MASCOT_STATES, type MascotState } from '@/components/mascot/states';

const LINES: Record<MascotState, string> = {
  idle: 'Ready when you are!',
  talking: "Here's your first clue...",
  thinking: 'Hmm, let me take a look...',
  celebrating: 'You found it!',
  sad: "Not quite. Keep looking!",
  shocked: "You've been knocked out!",
  countdown: 'Three, two, one...',
  trophy: 'And the champion is...',
};

export default function MascotDevPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <h1 className="mb-6 text-3xl text-leaf">Mascot states</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {MASCOT_STATES.map((state) => (
          <section key={state} className="card flex flex-col items-center gap-3 p-4">
            <h2 className="text-lg text-ink">{state}</h2>
            <Mascot state={state} line={LINES[state]} size="md" />
          </section>
        ))}
      </div>
    </main>
  );
}
