import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Utterance } from '../lib/types';
import { Transcript, utteranceAt } from './Transcript';

const utterances: Utterance[] = [
  { index: 0, start: 5, speaker: 'Priya Shah', text: 'Morning everyone.' },
  { index: 1, start: 70, speaker: 'Tom Becker', text: 'Spike results are in.' },
  { index: 2, start: 130, speaker: 'Priya Shah', text: 'We move launch to the 20th.' },
];

describe('utteranceAt', () => {
  it('finds the utterance being spoken at a time', () => {
    expect(utteranceAt(utterances, 0)?.index).toBe(0);
    expect(utteranceAt(utterances, 100)?.index).toBe(1);
    expect(utteranceAt(utterances, 999)?.index).toBe(2);
  });
});

describe('Transcript', () => {
  it('filters lines and seeks on timestamp click', () => {
    const onSeek = vi.fn();
    render(<Transcript utterances={utterances} focus={null} onSeek={onSeek} />);
    fireEvent.change(screen.getByLabelText('Search the transcript'), {
      target: { value: 'launch' },
    });
    expect(screen.queryByText('Spike results are in.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('02:10'));
    expect(onSeek).toHaveBeenCalledWith(130);
  });
});
