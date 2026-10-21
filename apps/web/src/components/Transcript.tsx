import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatTime, speakerColor } from '../lib/format';
import type { Utterance } from '../lib/types';

export interface Focus {
  sec: number;
  nonce: number;
}

export function utteranceAt(utterances: Utterance[], sec: number): Utterance | undefined {
  let match = utterances[0];
  for (const u of utterances) {
    if (u.start > sec) break;
    match = u;
  }
  return match;
}

export function Transcript({
  utterances,
  focus,
  onSeek,
}: {
  utterances: Utterance[];
  focus: Focus | null;
  onSeek: (sec: number) => void;
}) {
  const refs = useRef(new Map<number, HTMLLIElement>());
  const [query, setQuery] = useState('');
  const target = focus ? utteranceAt(utterances, focus.sec) : undefined;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return utterances;
    return utterances.filter(
      (u) => u.text.toLowerCase().includes(q) || u.speaker.toLowerCase().includes(q),
    );
  }, [utterances, query]);

  useEffect(() => {
    if (!target) return;
    setQuery('');
    requestAnimationFrame(() =>
      refs.current.get(target.index)?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    );
  }, [target, focus?.nonce]);

  return (
    <div className="space-y-2">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search the transcript"
        aria-label="Search the transcript"
        className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
      />
      {!visible.length && <p className="py-4 text-center text-xs text-muted">No matching lines.</p>}
      <ol className="space-y-0.5">
        {visible.map((u) => (
          <li
            key={`${u.index}-${focus?.nonce ?? 0}`}
            ref={(el) => {
              if (el) refs.current.set(u.index, el);
            }}
            className={clsx(
              'grid grid-cols-[3.25rem_1fr] gap-2 rounded-lg px-1.5 py-1.5 text-[13px] leading-relaxed',
              target?.index === u.index && 'flash',
            )}
          >
            <button
              type="button"
              onClick={() => onSeek(u.start)}
              className="self-start pt-0.5 text-left font-mono text-[11px] text-muted tabular-nums hover:text-accent"
            >
              {formatTime(u.start)}
            </button>
            <p>
              <span className="mr-1.5 font-semibold" style={{ color: speakerColor(u.speaker) }}>
                {u.speaker}
              </span>
              {u.text}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
