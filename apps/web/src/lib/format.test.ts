import { describe, expect, it } from 'vitest';
import { formatDuration, formatTime, initials, speakerColor } from './format';

describe('format', () => {
  it('formats timestamps and durations', () => {
    expect(formatTime(83)).toBe('01:23');
    expect(formatTime(3723)).toBe('1:02:03');
    expect(formatDuration(20)).toBe('1 min');
    expect(formatDuration(3900)).toBe('1h 5m');
  });

  it('derives initials and stable speaker colours', () => {
    expect(initials('Priya Shah')).toBe('PS');
    expect(speakerColor('Tom Becker')).toBe(speakerColor('Tom Becker'));
    expect(speakerColor('Tom Becker')).toMatch(/^var\(--s\d\)$/);
  });
});
