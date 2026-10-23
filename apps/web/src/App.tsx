import clsx from 'clsx';
import { Menu, Sparkles, X } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { ActionBoard } from './components/ActionBoard';
import { Assistant } from './components/Assistant';
import { Welcome } from './components/EmptyState';
import { MeetingList } from './components/MeetingList';
import { MeetingPanel } from './components/MeetingPanel';
import type { Focus } from './components/Transcript';
import { IconButton, Spinner } from './components/ui';
import { useActionItems, useMeetings } from './hooks/queries';
import { useChat } from './hooks/useChat';
import type { ActionItem, Source } from './lib/types';

type View = 'meeting' | 'actions';

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/favicon.svg" alt="" className="size-7" />
      <span className="font-display text-xl leading-none font-semibold tracking-tight">Quorum</span>
    </div>
  );
}

function NavTab({
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
      aria-current={active}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors',
        active ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

function Drawer({
  side,
  onClose,
  className,
  children,
}: {
  side: 'left' | 'right';
  onClose: () => void;
  className: string;
  children: ReactNode;
}) {
  return (
    <div className={clsx('fixed inset-0 z-40', className)}>
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} />
      <aside
        className={clsx(
          'absolute inset-y-0 flex w-full flex-col bg-paper shadow-xl',
          side === 'left' ? 'left-0 max-w-xs' : 'right-0 max-w-md',
        )}
      >
        {children}
      </aside>
    </div>
  );
}

export function App() {
  const meetingsQuery = useMeetings();
  const meetings = useMemo(() => meetingsQuery.data ?? [], [meetingsQuery.data]);
  const openActions = useActionItems().data?.filter((a) => a.status === 'open').length ?? 0;
  const chat = useChat();

  const [view, setView] = useState<View>('meeting');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [pinned, setPinned] = useState<number[]>([]);
  const [draft, setDraft] = useState<{ text: string; nonce: number } | null>(null);
  const [meetingsOpen, setMeetingsOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  const current =
    meetings.find((m) => m.id === selectedId) ?? (selectedId ? undefined : meetings.at(-1));
  const numbers = new Set(meetings.map((m) => m.number));
  const visiblePinned = pinned.filter((n) => numbers.has(n));

  const openMoment = (meetingId: string | undefined, sec: number | null) => {
    if (!meetingId) return;
    setSelectedId(meetingId);
    setView('meeting');
    setAssistantOpen(false);
    if (sec !== null) setFocus({ sec, nonce: Date.now() });
  };
  const jumpTo = (item: ActionItem) => openMoment(item.meetingId, item.atSec);
  const openSource = (s: Source) =>
    openMoment(meetings.find((m) => m.number === s.meetingNumber)?.id, s.startSec);

  const focusMeeting = (n: number) => {
    const pinning = !visiblePinned.includes(n);
    setPinned(pinning ? [n] : []);
    if (pinning) {
      setAssistantOpen(true);
      setDraft({ text: '', nonce: Date.now() });
    }
  };

  const timeline = (
    <div className="h-full min-h-0 flex-1 overflow-y-auto p-4">
      <MeetingList
        meetings={meetings}
        loading={meetingsQuery.isLoading}
        selectedId={view === 'meeting' ? (current?.id ?? null) : null}
        onSelect={(m) => {
          setSelectedId(m.id);
          setView('meeting');
          setMeetingsOpen(false);
        }}
      />
    </div>
  );

  const assistant = (onClose?: () => void) => (
    <Assistant
      chat={chat}
      meetings={meetings}
      pinned={visiblePinned}
      draft={draft}
      onUnpin={(n) => setPinned((p) => p.filter((x) => x !== n))}
      onOpenSource={openSource}
      onClose={onClose}
    />
  );

  let content: ReactNode;
  if (meetingsQuery.isLoading) content = <Spinner className="mx-auto mt-20 text-accent" />;
  else if (view === 'actions') content = <ActionBoard onJump={jumpTo} />;
  else if (!current) content = <Welcome />;
  else
    content = (
      <MeetingPanel
        meetingId={current.id}
        focus={focus}
        pinned={visiblePinned.includes(current.number)}
        onSeek={(sec) => setFocus({ sec, nonce: Date.now() })}
        onAsk={focusMeeting}
      />
    );

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <IconButton
          label="Open meetings"
          className="md:hidden"
          onClick={() => setMeetingsOpen(true)}
        >
          <Menu className="size-4" />
        </IconButton>
        <Brand />
        <nav className="ml-2 hidden gap-1 rounded-lg bg-sunken p-1 sm:flex">
          <NavTab active={view === 'meeting'} onClick={() => setView('meeting')}>
            Meetings <span className="font-mono text-xs text-muted">{meetings.length}</span>
          </NavTab>
          <NavTab active={view === 'actions'} onClick={() => setView('actions')}>
            Action items
            {openActions > 0 && (
              <span className="rounded bg-amber-soft px-1 font-mono text-xs text-amber">
                {openActions}
              </span>
            )}
          </NavTab>
        </nav>
        <button
          type="button"
          onClick={() => setAssistantOpen(true)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink xl:hidden"
        >
          <Sparkles className="size-3.5" /> Ask
        </button>
      </header>

      <nav className="flex gap-1 border-b border-line bg-sunken/60 p-1 sm:hidden">
        <NavTab active={view === 'meeting'} onClick={() => setView('meeting')}>
          Meetings
        </NavTab>
        <NavTab active={view === 'actions'} onClick={() => setView('actions')}>
          Action items {openActions > 0 && <span className="text-amber">{openActions}</span>}
        </NavTab>
      </nav>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[280px_1fr] xl:grid-cols-[280px_1fr_400px]">
        <aside className="hidden min-h-0 border-r border-line md:block">{timeline}</aside>
        <main
          key={view === 'actions' ? 'actions' : current?.id}
          className="min-h-0 overflow-y-auto"
        >
          <div className="mx-auto max-w-4xl px-5 py-8 md:px-10">{content}</div>
        </main>
        <aside className="hidden min-h-0 border-l border-line bg-surface/50 xl:block">
          {assistant()}
        </aside>
      </div>

      {meetingsOpen && (
        <Drawer side="left" className="md:hidden" onClose={() => setMeetingsOpen(false)}>
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <Brand />
            <IconButton label="Close meetings" onClick={() => setMeetingsOpen(false)}>
              <X className="size-4" />
            </IconButton>
          </div>
          {timeline}
        </Drawer>
      )}

      {assistantOpen && (
        <Drawer side="right" className="xl:hidden" onClose={() => setAssistantOpen(false)}>
          {assistant(() => setAssistantOpen(false))}
        </Drawer>
      )}
    </div>
  );
}
