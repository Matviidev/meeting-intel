import clsx from 'clsx';
import { ArrowUpRight } from 'lucide-react';
import type { Meeting } from '../lib/types';

export function suggestions(meetings: Meeting[]): string[] {
  const latest = meetings.at(-1);
  if (!latest) return [];
  const person = latest.speakers[0]?.name.split(' ')[0];
  return [
    meetings.length > 1
      ? 'What decisions have we made so far, and did any of them change later?'
      : `What did we decide in meeting #${latest.number}?`,
    'Which action items are still open, and who owns them?',
    person
      ? `What did ${person} commit to in the last meeting?`
      : `Summarise meeting #${latest.number} in five bullets.`,
    'What risks or open questions came up that nobody resolved?',
  ];
}

function Step({ n, done, children }: { n: number; done: boolean; children: string }) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={clsx(
          'grid size-6 place-items-center rounded-full font-mono text-xs',
          done ? 'bg-accent text-accent-ink' : 'border border-line text-muted',
        )}
      >
        {done ? '✓' : n}
      </span>
      <span className={done ? 'text-muted line-through' : ''}>{children}</span>
    </li>
  );
}

export function EmptyState({
  meetings,
  onPick,
}: {
  meetings: Meeting[];
  onPick: (q: string) => void;
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col justify-center py-10">
      <p className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">
        Meeting intelligence
      </p>
      <h1 className="mt-3 font-serif text-4xl leading-[1.05] sm:text-5xl">
        Remember every decision, <em className="text-accent">without</em> re-watching the call.
      </h1>
      <p className="mt-4 max-w-lg text-muted">
        Quorum reads your meeting transcripts, pulls out decisions and action items, and answers
        questions with links to the exact moment something was said.
      </p>

      {!meetings.length ? (
        <ol className="mt-8 space-y-3 text-sm">
          <Step n={1} done={false}>
            Add a transcript with speaker names and timestamps
          </Step>
          <Step n={2} done={false}>
            Review the extracted decisions and action items
          </Step>
          <Step n={3} done={false}>
            Ask what was decided, by whom, and what's still open
          </Step>
        </ol>
      ) : (
        <div className="mt-8 grid gap-2 sm:grid-cols-2">
          {suggestions(meetings).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onPick(q)}
              className="group flex items-start justify-between gap-3 rounded-xl border border-line bg-surface p-4 text-left text-sm transition-colors hover:border-accent/50 hover:bg-accent-soft"
            >
              {q}
              <ArrowUpRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
