import clsx from 'clsx';
import { CheckSquare, Trash2 } from 'lucide-react';
import { useAddMeeting, useDeleteMeeting } from '../hooks/queries';
import { formatDate, formatDuration } from '../lib/format';
import type { Meeting } from '../lib/types';
import { AvatarStack, IconButton, SectionLabel } from './ui';
import { UploadZone } from './UploadZone';

export function MeetingList({
  meetings,
  loading,
  selectedId,
  onSelect,
}: {
  meetings: Meeting[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (meeting: Meeting) => void;
}) {
  const add = useAddMeeting();
  const remove = useDeleteMeeting();
  const newestFirst = [...meetings].reverse();

  return (
    <section className="space-y-4">
      <SectionLabel>Timeline</SectionLabel>
      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-sunken" />
          ))}
        </div>
      ) : (
        <ol className="relative space-y-1 before:absolute before:top-3 before:bottom-3 before:left-[7px] before:w-px before:bg-line">
          {newestFirst.map((m) => {
            const active = selectedId === m.id;
            return (
              <li key={m.id} className="group relative pl-6">
                <span
                  aria-hidden
                  className={clsx(
                    'absolute top-3.5 left-0 size-[15px] rounded-full border-2 bg-paper',
                    active ? 'border-accent bg-accent' : 'border-line',
                  )}
                />
                <button
                  type="button"
                  onClick={() => onSelect(m)}
                  aria-pressed={active}
                  className={clsx(
                    'w-full rounded-xl px-3 py-2.5 pr-8 text-left transition-colors',
                    active ? 'bg-surface shadow-sm ring-1 ring-line' : 'hover:bg-sunken',
                  )}
                >
                  <p className="tabular-nums text-[10px] tracking-wide text-muted uppercase">
                    #{m.number} · {formatDate(m.occurredOn, false) ?? 'No date'} ·{' '}
                    {formatDuration(m.durationSec)}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-medium">{m.title}</p>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted">
                    <AvatarStack names={m.speakers.map((s) => s.name)} />
                    {m.openActionCount > 0 && (
                      <span className="ml-auto inline-flex items-center gap-1 text-amber">
                        <CheckSquare className="size-3" /> {m.openActionCount} open
                      </span>
                    )}
                  </div>
                </button>
                <IconButton
                  label={`Delete meeting #${m.number}`}
                  className="absolute top-1.5 right-1 opacity-0 group-hover:opacity-100 focus:opacity-100"
                  onClick={() => remove.mutate(m.id)}
                >
                  <Trash2 className="size-3.5" />
                </IconButton>
              </li>
            );
          })}
        </ol>
      )}
      <UploadZone
        pending={add.isPending}
        error={add.error?.message}
        onSubmit={(input) => add.mutate(input, { onSuccess: (m) => onSelect(m) })}
      />
    </section>
  );
}
