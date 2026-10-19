export function parseTimestamp(raw: string): number | null {
  const m = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,]\d{1,3})?$/.exec(raw.trim());
  if (!m) return null;
  const [, h = '0', min, sec] = m;
  if (Number(sec) >= 60 || (m[1] !== undefined && Number(min) >= 60)) return null;
  return Number(h) * 3600 + Number(min) * 60 + Number(sec);
}

export function formatTime(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

export function formatRange(start: number, end: number): string {
  return `${formatTime(start)}–${formatTime(end)}`;
}
