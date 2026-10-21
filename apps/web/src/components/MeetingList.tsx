import clsx from 'clsx';
import { CheckSquare, Trash2 } from 'lucide-react';
import { useAddMeeting, useDeleteMeeting } from '../hooks/queries';
import { formatDate, formatDuration } from '../lib/format';
import type { Meeting } from '../lib/types';
import { AvatarStack, IconButton, MeetingBadge, SectionLabel } from './ui';
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
  onSelect: (meeting: Meeting | null) => void;
}) {
  const add = useAddMeeting();
  const remove = useDeleteMeeting();

  return (
    <section className="space-y-3">
      <SectionLabel>Meetings</SectionLabel>
      {loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-sunken" />
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {meetings.map((m) => (
            <li key={m.id} className="group relative">
              <button
                type="button"
                onClick={() => onSelect(selectedId === m.id ? null : m)}
                aria-pressed={selectedId === m.id}
                className={clsx(
                  'w-full rounded-xl border p-3 pr-9 text-left transition-colors',
                  selectedId === m.id
                    ? 'border-accent/50 bg-accent-soft'
                    : 'border-line bg-surface hover:border-accent/30',
                )}
              >
                <div className="flex items-center gap-2">
                  <MeetingBadge number={m.number} />
                  <span className="truncate text-sm font-medium">{m.title}</span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
                  <AvatarStack names={m.speakers.map((s) => s.name)} />
                  <span>{formatDate(m.occurredOn) ?? 'No date'}</span>
                  <span aria-hidden>·</span>
                  <span>{formatDuration(m.durationSec)}</span>
                  {m.openActionCount > 0 && (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-amber-soft px-1.5 py-0.5 text-amber">
                      <CheckSquare className="size-3" /> {m.openActionCount}
                    </span>
                  )}
                </div>
              </button>
              <IconButton
                label={`Delete meeting #${m.number}`}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus:opacity-100"
                onClick={() => {
                  if (selectedId === m.id) onSelect(null);
                  remove.mutate(m.id);
                }}
              >
                <Trash2 className="size-3.5" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      <UploadZone
        pending={add.isPending}
        error={add.error?.message}
        onSubmit={(input) => add.mutate(input, { onSuccess: (m) => onSelect(m) })}
      />
    </section>
  );
}
