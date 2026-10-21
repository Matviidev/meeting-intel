import { useCallback, useRef, useState } from 'react';
import { ApiError, api, streamChat } from '../lib/api';
import type { ChatMessage } from '../lib/types';

const id = () => crypto.randomUUID();

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const patch = useCallback((messageId: string, update: (m: ChatMessage) => ChatMessage) => {
    setMessages((all) => all.map((m) => (m.id === messageId ? update(m) : m)));
  }, []);

  const send = useCallback(
    async (question: string, pinnedMeetings: number[]) => {
      if (streaming) return;
      const history = messages
        .filter((m) => m.status !== 'error' && m.content)
        .map((m) => ({ role: m.role, content: m.content }));
      const answerId = id();
      setMessages((all) => [
        ...all,
        { id: id(), role: 'user', content: question },
        { id: answerId, role: 'assistant', content: '', status: 'streaming' },
      ]);
      setStreaming(true);
      const abort = new AbortController();
      abortRef.current = abort;

      try {
        await streamChat(
          { question, history, pinnedMeetings },
          {
            onMeta: (meta) => patch(answerId, (m) => ({ ...m, meta })),
            onDelta: (text) => patch(answerId, (m) => ({ ...m, content: m.content + text })),
            onDone: (done) => patch(answerId, (m) => ({ ...m, done, status: 'done' })),
            onError: (error) => patch(answerId, (m) => ({ ...m, error, status: 'error' })),
          },
          abort.signal,
        );
        patch(answerId, (m) => (m.status === 'streaming' ? { ...m, status: 'done' } : m));
      } catch (err) {
        const message = abort.signal.aborted
          ? 'Stopped.'
          : err instanceof ApiError
            ? err.message
            : 'Could not reach the server.';
        patch(answerId, (m) => ({ ...m, error: message, status: 'error' }));
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, patch, streaming],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
  }, []);

  const rate = useCallback(
    async (messageId: string, traceId: string, value: 1 | -1) => {
      patch(messageId, (m) => ({ ...m, feedback: value }));
      await api
        .feedback(traceId, value)
        .catch(() => patch(messageId, (m) => ({ ...m, feedback: undefined })));
    },
    [patch],
  );

  return { messages, streaming, send, stop, reset, rate };
}
