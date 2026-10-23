export const TRANSCRIPT_EXTENSIONS = ['.txt', '.md', '.vtt', '.srt'];
export const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg', '.webm', '.flac', '.mp4'];
export const ACCEPT = [...TRANSCRIPT_EXTENSIONS, ...AUDIO_EXTENSIONS].join(',');

export function isAudio(input: File | string): boolean {
  if (typeof input === 'string') return false;
  const ext = input.name.slice(input.name.lastIndexOf('.')).toLowerCase();
  return AUDIO_EXTENSIONS.includes(ext) || input.type.startsWith('audio/');
}

export function recordingName(mimeType = '', date = new Date()): string {
  const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm';
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `Recording ${stamp}.${ext}`;
}
