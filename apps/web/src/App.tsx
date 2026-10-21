import { useState } from 'react';
import { MeetingList } from './components/MeetingList';
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

  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-[300px_1fr]">
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
    </div>
  );
}
