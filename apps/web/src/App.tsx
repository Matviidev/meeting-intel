import clsx from 'clsx';
import { RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionBoard } from './components/ActionBoard';
import { Composer } from './components/Composer';
import { EmptyState } from './components/EmptyState';
import { MeetingList } from './components/MeetingList';
import { MeetingPanel } from './components/MeetingPanel';
import { MessageView } from './components/MessageView';
import type { Focus } from './components/Transcript';
import { Button } from './components/ui';
import { useMeetings } from './hooks/queries';
import { useChat } from './hooks/useChat';
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
  const meetingsQuery = useMeetings();
  const meetings = useMemo(() => meetingsQuery.data ?? [], [meetingsQuery.data]);
  const chat = useChat();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [pinned, setPinned] = useState<number[]>([]);
  const [tab, setTab] = useState<Tab>('meeting');
  const [draft, setDraft] = useState<{ text: string; nonce: number } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const numbers = useMemo(() => new Set(meetings.map((m) => m.number)), [meetings]);
  const visiblePinned = pinned.filter((n) => numbers.has(n));
  const selected = meetings.find((m) => m.id === selectedId);
  const lastAnswer = [...chat.messages].reverse().find((m) => m.role === 'assistant');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat.messages.length, lastAnswer?.content.length]);

  const send = (question: string) => void chat.send(question, visiblePinned);

  const jumpTo = (item: ActionItem) => {
    setSelectedId(item.meetingId);
    setTab('meeting');
    if (item.atSec !== null) setFocus({ sec: item.atSec, nonce: Date.now() });
  };

  const focusMeeting = (n: number) => {
    setPinned((p) => (p.includes(n) ? [] : [n]));
    if (!pinned.includes(n)) setDraft({ text: '', nonce: Date.now() });
  };

  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-[300px_1fr] lg:grid-cols-[300px_1fr_420px]">
      <aside className="hidden flex-col gap-6 overflow-y-auto border-r border-line bg-paper p-5 md:flex">
        <Brand />
        <MeetingList
          meetings={meetings}
          loading={meetingsQuery.isLoading}
          selectedId={selectedId}
          onSelect={(m) => {
            setSelectedId(m?.id ?? null);
            if (m) setTab('meeting');
          }}
        />
      </aside>

      <main className="flex min-h-0 min-w-0 flex-col">
        <header className="flex items-center gap-2 border-b border-line px-4 py-2.5 md:px-6">
          <p className="text-sm text-muted">
            {meetings.length
              ? `${meetings.length} meeting${meetings.length > 1 ? 's' : ''} indexed`
              : 'No meetings yet'}
          </p>
          {chat.messages.length > 0 && (
            <Button variant="ghost" className="ml-auto" onClick={chat.reset}>
              <RotateCcw className="size-3.5" /> New chat
            </Button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-4 md:px-6">
          <div className="mx-auto max-w-3xl space-y-4 py-6">
            {chat.messages.length === 0 ? (
              <EmptyState meetings={meetings} onPick={send} />
            ) : (
              chat.messages.map((m) => (
                <MessageView
                  key={m.id}
                  message={m}
                  active={false}
                  onCite={() => undefined}
                  onShowSources={() => undefined}
                  onRate={(v) => m.meta && chat.rate(m.id, m.meta.traceId, v)}
                />
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="px-4 pb-4 md:px-6 md:pb-6">
          <div className="mx-auto max-w-3xl">
            <Composer
              disabled={!meetings.length}
              streaming={chat.streaming}
              pinned={visiblePinned}
              meetings={meetings}
              draft={draft}
              onUnpin={(n) => setPinned((p) => p.filter((x) => x !== n))}
              onSend={send}
              onStop={chat.stop}
            />
          </div>
        </div>
      </main>

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
              pinned={!!selected && visiblePinned.includes(selected.number)}
              onSeek={(sec) => setFocus({ sec, nonce: Date.now() })}
              onAsk={focusMeeting}
            />
          )}
          {tab === 'actions' && <ActionBoard onJump={jumpTo} />}
        </div>
      </aside>
    </div>
  );
}
