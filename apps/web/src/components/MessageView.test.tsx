import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage, Source } from '../lib/types';
import { MessageView } from './MessageView';

const source = (label: string): Source => ({
  label,
  meetingNumber: 2,
  meetingTitle: 'Sprint planning',
  startSec: 60,
  endSec: 120,
  speakers: ['Priya Shah'],
  content: '',
});

const message: ChatMessage = {
  id: 'a',
  role: 'assistant',
  content: 'Priya (01:50) moved the launch [M2.1] after the spike [M2.2] and [M7.1].',
  status: 'done',
  meta: {
    traceId: 't',
    scope: { reason: 'mentioned', meetings: [2], unknown: [], speakers: ['Priya Shah'] },
    sources: [source('M2.1'), source('M2.2')],
    flags: [],
  },
  done: {
    cited: ['M2.1', 'M2.2'],
    unknownCitations: ['M7.1'],
    unverifiedAttributions: ['Priya (01:50)'],
    flags: ['unknown_citation', 'unverified_attribution'],
  },
};

function renderMessage(onCite = vi.fn(), onToggle = vi.fn()) {
  render(
    <MessageView
      message={message}
      expanded={null}
      highlight={null}
      onCite={onCite}
      onToggle={onToggle}
      onOpenSource={vi.fn()}
      onRate={vi.fn()}
    />,
  );
  return { onCite, onToggle };
}

describe('MessageView', () => {
  it('renders citations as buttons and reports clicks', () => {
    const { onCite } = renderMessage();
    fireEvent.click(screen.getByRole('button', { name: 'M2.1' }));
    expect(onCite).toHaveBeenCalledWith('M2.1');
    expect(screen.getByRole('button', { name: 'M7.1' })).toHaveAttribute(
      'title',
      expect.stringMatching(/not among/),
    );
  });

  it('shows scope and guardrail warnings', () => {
    renderMessage();
    expect(screen.getByText('Meeting #2 · focus on Priya Shah')).toBeInTheDocument();
    expect(screen.getByText(/cites an excerpt that was not retrieved/)).toBeInTheDocument();
    expect(screen.getByText(/Could not find Priya \(01:50\)/)).toBeInTheDocument();
  });

  it('toggles inline sources', () => {
    const { onToggle } = renderMessage();
    fireEvent.click(screen.getByRole('button', { name: /2 sources/ }));
    expect(onToggle).toHaveBeenCalledWith('sources');
  });
});
