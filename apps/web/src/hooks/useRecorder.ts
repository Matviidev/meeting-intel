import { useEffect, useRef, useState } from 'react';
import { recordingName } from '../lib/files';

export const canRecord =
  typeof window !== 'undefined' &&
  typeof window.MediaRecorder !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia;

export function useRecorder(onRecorded: (file: File) => void) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const keep = useRef(false);
  const onRecordedRef = useRef(onRecorded);
  onRecordedRef.current = onRecorded;

  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed((Date.now() - started) / 1000), 250);
    return () => clearInterval(timer);
  }, [recording]);

  useEffect(() => () => recorder.current?.stream.getTracks().forEach((t) => t.stop()), []);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setElapsed(0);
        if (keep.current && chunks.length) {
          const type = rec.mimeType || 'audio/webm';
          onRecordedRef.current(new File(chunks, recordingName(type), { type }));
        }
      };
      recorder.current = rec;
      rec.start(1000);
      setRecording(true);
    } catch {
      setError('Microphone access was blocked. Allow it in the browser to record.');
    }
  };

  const stop = (save: boolean) => {
    keep.current = save;
    recorder.current?.stop();
    recorder.current = null;
  };

  return { recording, elapsed, error, start, finish: () => stop(true), cancel: () => stop(false) };
}
