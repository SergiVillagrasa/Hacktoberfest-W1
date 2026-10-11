const TOTAL = 5;

export function AttemptsDots({ left }: { left: number }) {
  return (
    <div className="flex flex-col items-center gap-1" role="img" aria-label={`${left} of ${TOTAL} attempts left`}>
      <div className="flex gap-1.5">
        {Array.from({ length: TOTAL }, (_, i) => (
          <span key={i} className={`size-3.5 rounded-full ${i < left ? 'bg-leaf' : 'bg-line-deep'}`} />
        ))}
      </div>
      <p className="text-xs font-bold text-ink-soft">{left} left</p>
    </div>
  );
}
