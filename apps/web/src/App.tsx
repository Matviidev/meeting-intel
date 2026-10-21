import { useState } from 'react';
import { MeetingList } from './components/MeetingList';
import { MeetingPanel } from './components/MeetingPanel';
import type { Focus } from './components/Transcript';
import { useMeetings } from './hooks/queries';

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
  const selected = meetings.data?.find((m) => m.id === selectedId);

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
      <aside className="hidden overflow-y-auto border-l border-line bg-paper p-5 lg:block">
        <MeetingPanel
          meetingId={selectedId}
          focus={focus}
          pinned={!!selected && pinned.includes(selected.number)}
          onSeek={(sec) => setFocus({ sec, nonce: Date.now() })}
          onAsk={(n) => setPinned((p) => (p.includes(n) ? [] : [n]))}
        />
      </aside>
    </div>
  );
}
