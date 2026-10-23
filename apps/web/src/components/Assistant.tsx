import { RotateCcw, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { useChat } from '../hooks/useChat';
import type { Meeting, Source } from '../lib/types';
import { Composer } from './Composer';
import { Suggestions } from './EmptyState';
import { MessageView, type Expanded } from './MessageView';
import { Button, IconButton } from './ui';

export function Assistant({
  chat,
  meetings,
  pinned,
  draft,
  onUnpin,
  onOpenSource,
  onClose,
}: {
  chat: ReturnType<typeof useChat>;
  meetings: Meeting[];
  pinned: number[];
  draft: { text: string; nonce: number } | null;
  onUnpin: (n: number) => void;
  onOpenSource: (source: Source) => void;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState<{ id: string; panel: Expanded } | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const last = chat.messages.at(-1);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat.messages.length, last?.content.length]);

  const send = (question: string) => {
    setOpen(null);
    setHighlight(null);
    void chat.send(question, pinned);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Sparkles className="size-4 text-accent" />
        <h2 className="text-sm font-semibold">Ask Quorum</h2>
        <div className="ml-auto flex items-center gap-1">
          {chat.messages.length > 0 && (
            <Button variant="ghost" className="px-2 py-1 text-xs" onClick={chat.reset}>
              <RotateCcw className="size-3" /> New chat
            </Button>
          )}
          {onClose && (
            <IconButton label="Close assistant" onClick={onClose}>
              <X className="size-4" />
            </IconButton>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4">
        {chat.messages.length === 0 ? (
          <Suggestions meetings={meetings} onPick={send} />
        ) : (
          <div className="space-y-3 py-4">
            {chat.messages.map((m) => (
              <MessageView
                key={m.id}
                message={m}
                expanded={open?.id === m.id ? open.panel : null}
                highlight={open?.id === m.id ? highlight : null}
                onCite={(label) => {
                  setOpen({ id: m.id, panel: 'sources' });
                  setHighlight(label);
                }}
                onToggle={(panel) => {
                  setOpen(panel ? { id: m.id, panel } : null);
                  setHighlight(null);
                }}
                onOpenSource={onOpenSource}
                onRate={(v) => m.meta && chat.rate(m.id, m.meta.traceId, v)}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="border-t border-line p-3">
        <Composer
          disabled={!meetings.length}
          streaming={chat.streaming}
          pinned={pinned}
          meetings={meetings}
          draft={draft}
          onUnpin={onUnpin}
          onSend={send}
          onStop={chat.stop}
        />
        <p className="mt-2 text-center text-[11px] text-muted">
          Answers can be wrong. Check the cited moments.
        </p>
      </div>
    </div>
  );
}
