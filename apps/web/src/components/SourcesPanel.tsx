import clsx from 'clsx';
import { PlayCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { formatTime, speakerColor } from '../lib/format';
import type { ChatMessage, Source } from '../lib/types';
import { AvatarStack } from './ui';

const LINE = /^\[([\d:]+)\] ([^:]+): (.*)$/;

function ExcerptLines({ content }: { content: string }) {
  return (
    <div className="space-y-1 text-xs leading-relaxed">
      {content.split('\n').map((line, i) => {
        const m = LINE.exec(line);
        if (!m) return <p key={i}>{line}</p>;
        return (
          <p key={i}>
            <span className="mr-1.5 font-mono text-[10px] text-muted">{m[1]}</span>
            <span className="mr-1 font-semibold" style={{ color: speakerColor(m[2]!) }}>
              {m[2]}
            </span>
            {m[3]}
          </p>
        );
      })}
    </div>
  );
}

export function SourcesPanel({
  message,
  highlight,
  onOpen,
}: {
  message: ChatMessage | undefined;
  highlight: string | null;
  onOpen: (source: Source) => void;
}) {
  const refs = useRef(new Map<string, HTMLLIElement>());

  useEffect(() => {
    if (highlight)
      refs.current.get(highlight)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlight, message?.id]);

  if (!message?.meta) {
    return (
      <div className="px-1 py-10 text-center text-sm text-muted">
        Ask a question to see which transcript excerpts the answer was built from.
      </div>
    );
  }

  const cited = new Set(message.done?.cited ?? []);
  const sources = [...message.meta.sources].sort(
    (a, b) => Number(cited.has(b.label)) - Number(cited.has(a.label)),
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        {message.meta.sources.length} excerpts retrieved · {cited.size} cited in the answer
      </p>
      <ul className="space-y-2">
        {sources.map((s) => (
          <li
            key={s.label}
            ref={(el) => {
              if (el) refs.current.set(s.label, el);
            }}
            className={clsx(
              'rounded-lg border p-2.5 transition-colors',
              highlight === s.label ? 'border-accent bg-accent-soft' : 'border-line bg-surface',
              !cited.has(s.label) && highlight !== s.label && 'opacity-70',
            )}
          >
            <div className="mb-2 flex items-center gap-2 text-xs">
              <span className="rounded bg-accent px-1.5 py-0.5 font-mono text-[10px] font-semibold text-accent-ink">
                {s.label}
              </span>
              <span className="truncate font-medium">
                #{s.meetingNumber} {s.meetingTitle}
              </span>
              {cited.has(s.label) && <span className="ml-auto text-[10px] text-good">cited</span>}
            </div>
            <div className="line-clamp-[10]">
              <ExcerptLines content={s.content} />
            </div>
            <div className="mt-2 flex items-center gap-2 border-t border-line pt-2 text-[11px] text-muted">
              <AvatarStack names={s.speakers} />
              <span className="font-mono">
                {formatTime(s.startSec)}–{formatTime(s.endSec)}
              </span>
              <button
                type="button"
                onClick={() => onOpen(s)}
                className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-accent hover:bg-accent-soft"
              >
                <PlayCircle className="size-3.5" /> Open in transcript
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
