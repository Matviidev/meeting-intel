import clsx from 'clsx';
import { FileAudio2, Mic, Square, X } from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { canRecord, useRecorder } from '../hooks/useRecorder';
import { ACCEPT, isAudio } from '../lib/files';
import { formatTime } from '../lib/format';
import { Button, ErrorNote, Spinner } from './ui';

const TEXT_STEPS = [
  'Reading speakers and timestamps…',
  'Extracting decisions and action items…',
  'Indexing the transcript for search…',
];
const AUDIO_STEPS = [
  'Transcribing the recording…',
  'Working out who is speaking…',
  'Extracting decisions and action items…',
  'Indexing the transcript for search…',
];

export function UploadZone({
  onSubmit,
  pending,
  error,
}: {
  onSubmit: (input: File | string) => void;
  pending: boolean;
  error?: string | null;
}) {
  const [mode, setMode] = useState<'file' | 'paste'>('file');
  const [text, setText] = useState('');
  const [dragging, setDragging] = useState(false);
  const [audio, setAudio] = useState(false);
  const [step, setStep] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const steps = audio ? AUDIO_STEPS : TEXT_STEPS;

  const submit = (input: File | string) => {
    setAudio(isAudio(input));
    onSubmit(input);
  };
  const recorder = useRecorder(submit);

  useEffect(() => {
    if (!pending) return setStep(0);
    const timer = setInterval(
      () => setStep((s) => Math.min(s + 1, steps.length - 1)),
      audio ? 8000 : 3000,
    );
    return () => clearInterval(timer);
  }, [pending, audio, steps.length]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) submit(file);
  };

  if (pending) {
    return (
      <div
        className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-5 text-sm"
        aria-live="polite"
      >
        <Spinner className="text-accent" />
        <span>{steps[step]}</span>
      </div>
    );
  }

  if (recorder.recording) {
    return (
      <div className="rounded-xl border border-line bg-surface px-4 py-5 text-center">
        <p
          className="flex items-center justify-center gap-2 text-sm font-medium"
          aria-live="polite"
        >
          <span className="size-2.5 animate-pulse rounded-full bg-bad" aria-hidden />
          Recording <span className="tabular-nums">{formatTime(recorder.elapsed)}</span>
        </p>
        <p className="mt-0.5 text-xs text-muted">Speakers are inferred from the conversation</p>
        <div className="mt-3 flex justify-center gap-2">
          <Button variant="primary" onClick={recorder.finish}>
            <Square className="size-3.5" aria-hidden />
            Stop and analyse
          </Button>
          <Button variant="ghost" onClick={recorder.cancel}>
            <X className="size-3.5" aria-hidden />
            Discard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {mode === 'file' ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={clsx(
            'rounded-xl border border-dashed px-4 py-5 text-center transition-colors',
            dragging ? 'border-accent bg-accent-soft' : 'border-line bg-surface',
          )}
        >
          <FileAudio2 className="mx-auto mb-2 size-5 text-accent" aria-hidden />
          <p className="text-sm font-medium">Add a meeting</p>
          <p className="mt-0.5 text-xs text-muted">
            Transcript (TXT, MD, VTT, SRT) or audio (MP3, WAV, M4A, WebM)
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button variant="primary" onClick={() => inputRef.current?.click()}>
              Choose file
            </Button>
            {canRecord && (
              <Button onClick={() => void recorder.start()}>
                <Mic className="size-3.5" aria-hidden />
                Record
              </Button>
            )}
            <Button variant="ghost" onClick={() => setMode('paste')}>
              Paste text
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            aria-label="Transcript or audio file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) submit(file);
              e.target.value = '';
            }}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'[00:00:05] Priya: Morning all…\n[00:00:12] Tom: …'}
            rows={8}
            autoFocus
            className="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 tabular-nums text-xs outline-none focus:border-accent"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setMode('file')}>
              Upload instead
            </Button>
            <Button
              variant="primary"
              disabled={text.trim().length < 50}
              onClick={() => {
                submit(text);
                setText('');
                setMode('file');
              }}
            >
              Analyse
            </Button>
          </div>
        </div>
      )}
      {(recorder.error ?? error) && <ErrorNote>{recorder.error ?? error}</ErrorNote>}
    </div>
  );
}
