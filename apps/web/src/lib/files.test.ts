import { describe, expect, it } from 'vitest';
import { isAudio, recordingName } from './files';

describe('files', () => {
  it('tells audio apart from transcripts', () => {
    expect(isAudio(new File(['x'], 'call.MP3'))).toBe(true);
    expect(isAudio(new File(['x'], 'voice', { type: 'audio/ogg' }))).toBe(true);
    expect(isAudio(new File(['x'], 'notes.vtt'))).toBe(false);
    expect(isAudio('[00:01] Ana: hi')).toBe(false);
  });

  it('names recordings by date and time', () => {
    const at = new Date(2026, 9, 23, 9, 5);
    expect(recordingName('audio/webm;codecs=opus', at)).toBe('Recording 2026-10-23 0905.webm');
    expect(recordingName('audio/mp4', at)).toBe('Recording 2026-10-23 0905.m4a');
  });
});
