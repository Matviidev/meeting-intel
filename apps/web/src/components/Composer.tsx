import { ArrowUp, Square, X } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Meeting } from '../lib/types';
import { MeetingBadge } from './ui';

export function Composer({
  disabled,
  streaming,
  pinned,
  meetings,
  draft,
  onUnpin,
  onSend,
  onStop,
}: {
  disabled: boolean;
  streaming: boolean;
  pinned: number[];
  meetings: Meeting[];
  draft: { text: string; nonce: number } | null;
  onUnpin: (n: number) => void;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!draft) return;
    setText(draft.text);
    ref.current?.focus();
  }, [draft]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const submit = () => {
    const q = text.trim();
    if (!q || disabled || streaming) return;
    onSend(q);
    setText('');
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-2 shadow-[0_1px_0_var(--line),0_8px_24px_-12px_rgb(0_0_0/0.15)] focus-within:border-accent/60">
      <div className="flex flex-wrap items-center gap-1.5 px-2 pt-1 pb-1.5 text-xs text-muted">
        <span>Asking about</span>
        {pinned.length ? (
          pinned.map((n) => (
            <span
              key={n}
              className="inline-flex items-center gap-1 rounded-md bg-accent-soft py-0.5 pr-1 pl-0.5 text-accent"
            >
              <MeetingBadge number={n} className="bg-transparent text-accent" />
              <span className="max-w-40 truncate">
                {meetings.find((m) => m.number === n)?.title}
              </span>
              <button
                type="button"
                aria-label={`Stop focusing on meeting #${n}`}
                onClick={() => onUnpin(n)}
                className="rounded hover:bg-accent hover:text-accent-ink"
              >
                <X className="size-3" />
              </button>
            </span>
          ))
        ) : (
          <span className="rounded-md bg-sunken px-1.5 py-0.5 text-ink">
            {meetings.length
              ? 'all meetings — or mention “meeting #2”, “the retro”, a date or a person'
              : 'nothing yet'}
          </span>
        )}
      </div>
      <div className="flex items-end gap-2">
        <label htmlFor="question" className="sr-only">
          Your question
        </label>
        <textarea
          id="question"
          ref={ref}
          rows={1}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            disabled ? 'Add a meeting transcript to start' : 'What did we decide about the launch?'
          }
          className="max-h-[200px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] outline-none placeholder:text-muted disabled:cursor-not-allowed"
        />
        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop generating"
            className="grid size-9 place-items-center rounded-xl bg-ink text-paper"
          >
            <Square className="size-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={disabled || !text.trim()}
            aria-label="Send"
            className="grid size-9 place-items-center rounded-xl bg-accent text-accent-ink transition-opacity disabled:opacity-30"
          >
            <ArrowUp className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
