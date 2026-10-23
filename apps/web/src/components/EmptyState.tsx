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

export function Suggestions({
  meetings,
  onPick,
}: {
  meetings: Meeting[];
  onPick: (q: string) => void;
}) {
  if (!meetings.length) {
    return (
      <p className="px-2 py-10 text-center text-sm text-muted">
        Add a transcript, then ask about decisions, owners and what's still open.
      </p>
    );
  }
  return (
    <div className="space-y-3 py-4">
      <p className="px-1 text-sm text-muted">
        Ask anything about your meetings. Answers link to the moment something was said.
      </p>
      <ul className="space-y-1.5">
        {suggestions(meetings).map((q) => (
          <li key={q}>
            <button
              type="button"
              onClick={() => onPick(q)}
              className="group flex w-full items-start justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-left text-sm transition-colors hover:border-accent/50 hover:bg-accent-soft"
            >
              {q}
              <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-muted group-hover:text-accent" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Step({ n, children }: { n: number; children: string }) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={clsx(
          'grid size-6 place-items-center rounded-full border border-line tabular-nums text-xs text-muted',
        )}
      >
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

export function Welcome() {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">
        Meeting intelligence
      </p>
      <h1 className="mt-3 text-3xl leading-[1.1] font-semibold tracking-tight sm:text-[2.6rem]">
        Remember every decision, <em className="text-accent">without</em> re-watching the call.
      </h1>
      <p className="mt-4 max-w-lg text-muted">
        Quorum reads your meeting transcripts, pulls out decisions and action items, and answers
        questions with links to the exact moment something was said.
      </p>
      <ol className="mt-8 space-y-3 text-sm">
        <Step n={1}>Add a transcript with speaker names and timestamps</Step>
        <Step n={2}>Review the extracted decisions and action items</Step>
        <Step n={3}>Ask what was decided, by whom, and what's still open</Step>
      </ol>
    </div>
  );
}
