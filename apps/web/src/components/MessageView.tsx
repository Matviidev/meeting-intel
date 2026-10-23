import clsx from 'clsx';
import {
  Activity,
  AlertTriangle,
  Check,
  Copy,
  FileSearch,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { ChatMessage, Source } from '../lib/types';
import { Answer } from './Answer';
import { SourcesPanel } from './SourcesPanel';
import { TracePanel } from './TracePanel';
import { IconButton } from './ui';

export type Expanded = 'sources' | 'trace' | null;

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={clsx(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs transition-colors',
        active ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-sunken hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

const FLAG_COPY: Record<string, (m: ChatMessage) => string> = {
  possible_prompt_injection: () =>
    'Your question looked like an instruction override; transcripts were still treated as data.',
  unknown_meeting_reference: (m) =>
    `There is no meeting ${m.meta?.scope.unknown.map((n) => `#${n}`).join(', ')}.`,
  unknown_citation: () =>
    'The answer cites an excerpt that was not retrieved — double-check that claim.',
  unverified_attribution: (m) =>
    `Could not find ${m.done?.unverifiedAttributions.join(', ')} in the cited excerpts — check who said it and when.`,
  no_citations: () => 'The answer has no citations; treat it as unverified.',
  refused: () => 'The model declined to answer this request.',
};

export function scopeLabel(message: ChatMessage): string | null {
  const scope = message.meta?.scope;
  if (!scope) return null;
  const meetings = scope.meetings.length
    ? `Meeting${scope.meetings.length > 1 ? 's' : ''} ${scope.meetings.map((n) => `#${n}`).join(', ')}`
    : 'No meetings';
  const who = scope.speakers.length ? ` · focus on ${scope.speakers.join(', ')}` : '';
  return `${scope.reason === 'all' ? 'All meetings' : meetings}${who}`;
}

export function MessageView({
  message,
  expanded,
  highlight,
  onCite,
  onToggle,
  onOpenSource,
  onRate,
}: {
  message: ChatMessage;
  expanded: Expanded;
  highlight: string | null;
  onCite: (label: string) => void;
  onToggle: (panel: Expanded) => void;
  onOpenSource: (source: Source) => void;
  onRate: (value: 1 | -1) => void;
}) {
  const [copied, setCopied] = useState(false);

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[90%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-sm whitespace-pre-wrap text-accent-ink">
          {message.content}
        </p>
      </div>
    );
  }

  const known = new Set(message.meta?.sources.map((s) => s.label) ?? []);
  const flags = (message.done?.flags ?? message.meta?.flags ?? []).filter((f) => FLAG_COPY[f]);
  const streaming = message.status === 'streaming';

  return (
    <article className="rounded-2xl border border-line bg-surface px-4 py-3.5 text-[14px]">
      {!message.content && streaming ? (
        <p className="text-sm text-muted">
          {message.meta
            ? `Reading ${message.meta.sources.length} transcript excerpts…`
            : 'Searching your meetings…'}
        </p>
      ) : (
        <Answer content={message.content} streaming={streaming} known={known} onCite={onCite} />
      )}

      {message.error && (
        <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-bad">
          <AlertTriangle className="size-4" /> {message.error}
        </p>
      )}

      {flags.length > 0 && !streaming && (
        <ul className="mt-3 space-y-1">
          {flags.map((f) => (
            <li
              key={f}
              className="flex items-start gap-2 rounded-lg bg-amber-soft px-3 py-1.5 text-xs text-amber"
            >
              <AlertTriangle className="mt-px size-3.5 shrink-0" /> {FLAG_COPY[f]!(message)}
            </li>
          ))}
        </ul>
      )}

      {message.meta && !streaming && (
        <footer className="mt-3 border-t border-line pt-2">
          <p className="mb-1 truncate text-[11px] text-muted">{scopeLabel(message)}</p>
          <div className="flex items-center gap-0.5">
            <Toggle
              active={expanded === 'sources'}
              onClick={() => onToggle(expanded === 'sources' ? null : 'sources')}
            >
              <FileSearch className="size-3.5" /> {message.meta.sources.length} sources
            </Toggle>
            <Toggle
              active={expanded === 'trace'}
              onClick={() => onToggle(expanded === 'trace' ? null : 'trace')}
            >
              <Activity className="size-3.5" /> Trace
            </Toggle>
            <span className="flex-1" />
            <IconButton
              label="Copy answer"
              onClick={() => {
                void navigator.clipboard.writeText(message.content);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check className="size-4 text-good" /> : <Copy className="size-4" />}
            </IconButton>
            <IconButton
              label="Helpful"
              onClick={() => onRate(1)}
              className={clsx(message.feedback === 1 && 'text-good')}
            >
              <ThumbsUp className="size-4" />
            </IconButton>
            <IconButton
              label="Not helpful"
              onClick={() => onRate(-1)}
              className={clsx(message.feedback === -1 && 'text-bad')}
            >
              <ThumbsDown className="size-4" />
            </IconButton>
          </div>
        </footer>
      )}

      {expanded && !streaming && (
        <div className="mt-2 max-h-[28rem] overflow-y-auto rounded-xl bg-sunken/60 p-2.5">
          {expanded === 'sources' ? (
            <SourcesPanel message={message} highlight={highlight} onOpen={onOpenSource} />
          ) : (
            <TracePanel message={message} />
          )}
        </div>
      )}
    </article>
  );
}
