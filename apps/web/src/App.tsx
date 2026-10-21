import clsx from 'clsx';
import { useState } from 'react';
import { ActionBoard } from './components/ActionBoard';
import { MeetingList } from './components/MeetingList';
import { MeetingPanel } from './components/MeetingPanel';
import type { Focus } from './components/Transcript';
import { useMeetings } from './hooks/queries';
import type { ActionItem } from './lib/types';

type Tab = 'meeting' | 'actions';

const TABS: { id: Tab; label: string }[] = [
  { id: 'meeting', label: 'Meeting' },
  { id: 'actions', label: 'Action items' },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/favicon.svg" alt="" className="size-7" />
      <span className="font-serif text-2xl leading-none">Quorum</span>
    </div>
  );
}

export function App() {
  const meetings = useMeetings();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [pinned, setPinned] = useState<number[]>([]);
  const [tab, setTab] = useState<Tab>('meeting');
  const selected = meetings.data?.find((m) => m.id === selectedId);

  const jumpTo = (item: ActionItem) => {
    setSelectedId(item.meetingId);
    setTab('meeting');
    if (item.atSec !== null) setFocus({ sec: item.atSec, nonce: Date.now() });
  };

  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-[300px_1fr] lg:grid-cols-[300px_1fr_420px]">
      <aside className="hidden flex-col gap-6 overflow-y-auto border-r border-line bg-paper p-5 md:flex">
        <Brand />
        <MeetingList
          meetings={meetings.data ?? []}
          loading={meetings.isLoading}
          selectedId={selectedId}
          onSelect={(m) => setSelectedId(m?.id ?? null)}
        />
      </aside>
      <main />
      <aside className="hidden flex-col border-l border-line bg-paper lg:flex">
        <div className="flex gap-1 border-b border-line px-3 pt-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={clsx(
                '-mb-px border-b-2 px-3 pb-2.5 text-sm font-medium',
                tab === t.id ? 'border-accent text-ink' : 'border-transparent text-muted',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'meeting' && (
            <MeetingPanel
              meetingId={selectedId}
              focus={focus}
              pinned={!!selected && pinned.includes(selected.number)}
              onSeek={(sec) => setFocus({ sec, nonce: Date.now() })}
              onAsk={(n) => setPinned((p) => (p.includes(n) ? [] : [n]))}
            />
          )}
          {tab === 'actions' && <ActionBoard onJump={jumpTo} />}
        </div>
      </aside>
    </div>
  );
}
