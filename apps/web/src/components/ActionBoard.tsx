import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { useActionItems } from '../hooks/queries';
import type { ActionItem } from '../lib/types';
import { ActionRow } from './ActionRow';
import { ErrorNote, SectionLabel, Spinner } from './ui';

type Filter = 'open' | 'done' | 'all';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'done', label: 'Done' },
  { id: 'all', label: 'All' },
];

export function groupByOwner(items: ActionItem[]): [string, ActionItem[]][] {
  const groups = new Map<string, ActionItem[]>();
  for (const item of items) {
    const owner = item.owner ?? 'Unassigned';
    groups.set(owner, [...(groups.get(owner) ?? []), item]);
  }
  return [...groups.entries()].sort(([a, x], [b, y]) => {
    if (a === 'Unassigned') return 1;
    if (b === 'Unassigned') return -1;
    return y.length - x.length || a.localeCompare(b);
  });
}

export function ActionBoard({ onJump }: { onJump: (item: ActionItem) => void }) {
  const { data, isLoading, error } = useActionItems();
  const [filter, setFilter] = useState<Filter>('open');

  const items = useMemo(
    () => (data ?? []).filter((a) => filter === 'all' || a.status === filter),
    [data, filter],
  );
  const counts = useMemo(
    () => ({
      open: data?.filter((a) => a.status === 'open').length ?? 0,
      done: data?.filter((a) => a.status === 'done').length ?? 0,
      all: data?.length ?? 0,
    }),
    [data],
  );

  if (isLoading) return <Spinner className="mx-auto mt-10 text-accent" />;
  if (error) return <ErrorNote>Could not load action items.</ErrorNote>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-3xl leading-tight">Action items</h2>
        <p className="mt-1 text-sm text-muted">
          Everything people committed to, across all meetings. Tick items off as they get done — the
          assistant sees the status too.
        </p>
      </div>
      <div className="flex gap-1 rounded-lg bg-sunken p-1" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={clsx(
              'flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
              filter === f.id ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
            )}
          >
            {f.label} <span className="font-mono text-muted">{counts[f.id]}</span>
          </button>
        ))}
      </div>
      {!items.length ? (
        <p className="py-6 text-center text-sm text-muted">
          {counts.all ? 'Nothing here.' : 'Upload a meeting to collect its action items.'}
        </p>
      ) : (
        groupByOwner(items).map(([owner, group]) => (
          <section key={owner}>
            <SectionLabel>
              {owner} · {group.length}
            </SectionLabel>
            <ul>
              {group.map((a) => (
                <ActionRow key={a.id} item={a} showMeeting onJump={onJump} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
