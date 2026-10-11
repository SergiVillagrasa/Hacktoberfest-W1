import type { FeedItem } from '@snaphunt/contracts';

export function Feed({ items, limit = 4 }: { items: FeedItem[]; limit?: number }) {
  const recent = items.slice(-limit).reverse();
  if (recent.length === 0) return <p className="text-sm text-ink-soft">Nothing yet. The first find will show up here.</p>;
  return (
    <ul className="flex flex-col gap-1.5" aria-live="polite" aria-label="What is happening">
      {recent.map((item) => (
        <li key={`${item.at}|${item.type}|${item.text}`} className="text-base text-ink">
          {item.text}
        </li>
      ))}
    </ul>
  );
}
