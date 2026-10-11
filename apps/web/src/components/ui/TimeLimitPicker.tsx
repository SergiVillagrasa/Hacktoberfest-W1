import { TIME_LIMITS, type TimeLimit } from '@/lib/forms';

interface TimeLimitPickerProps {
  value: TimeLimit;
  onChange: (value: TimeLimit) => void;
}

export function TimeLimitPicker({ value, onChange }: TimeLimitPickerProps) {
  return (
    <div role="radiogroup" aria-label="How long should the hunt last?" className="flex flex-col gap-1.5">
      <p className="text-base font-bold text-ink">How long should the hunt last?</p>
      <div className="grid grid-cols-4 gap-2">
        {TIME_LIMITS.map((minutes) => (
          <button key={minutes} type="button" role="radio" aria-checked={value === minutes} onClick={() => onChange(minutes)} className="chip tabular">
            {minutes} min
          </button>
        ))}
      </div>
    </div>
  );
}
