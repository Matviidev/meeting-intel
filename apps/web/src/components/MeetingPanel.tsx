import { HelpCircle, MessageSquareText, Pin, PinOff } from 'lucide-react';
import { useMeeting } from '../hooks/queries';
import { formatDate, formatDuration, formatTime, speakerColor } from '../lib/format';
import type { SpeakerStat } from '../lib/types';
import { ActionRow } from './ActionRow';
import { Transcript, type Focus } from './Transcript';
import { Button, ErrorNote, MeetingBadge, SectionLabel, Spinner, Timestamp } from './ui';

function TalkTime({ speakers }: { speakers: SpeakerStat[] }) {
  return (
    <div className="space-y-2">
      <div className="flex h-2 overflow-hidden rounded-full bg-sunken">
        {speakers.map((s) => (
          <span
            key={s.name}
            title={`${s.name} ${Math.round(s.share * 100)}%`}
            style={{ width: `${s.share * 100}%`, backgroundColor: speakerColor(s.name) }}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {speakers.map((s) => (
          <li key={s.name} className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: speakerColor(s.name) }}
            />
            <span className="truncate">{s.name}</span>
            <span className="ml-auto font-mono text-muted tabular-nums">
              {Math.round(s.share * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MeetingPanel({
  meetingId,
  focus,
  pinned,
  onSeek,
  onAsk,
}: {
  meetingId: string | null;
  focus: Focus | null;
  pinned: boolean;
  onSeek: (sec: number) => void;
  onAsk: (number: number) => void;
}) {
  const { data, isLoading, error } = useMeeting(meetingId);

  if (!meetingId) {
    return (
      <div className="px-1 py-10 text-center text-sm text-muted">
        Select a meeting to see its summary, decisions, action items and full transcript.
      </div>
    );
  }
  if (isLoading) return <Spinner className="mx-auto mt-10 text-accent" />;
  if (error || !data) return <ErrorNote>Could not load this meeting.</ErrorNote>;

  const { meeting, actionItems } = data;
  const { insights } = meeting;

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2 text-xs text-muted">
          <MeetingBadge number={meeting.number} />
          <span>{formatDate(meeting.occurredOn) ?? 'No date'}</span>
          <span aria-hidden>·</span>
          <span>{formatDuration(meeting.durationSec)}</span>
        </div>
        <h2 className="mt-2 font-serif text-3xl leading-tight">{meeting.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink/85">{insights.summary}</p>
        <Button
          variant={pinned ? 'outline' : 'primary'}
          className="mt-3"
          onClick={() => onAsk(meeting.number)}
        >
          {pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
          {pinned ? 'Stop focusing chat' : 'Ask about this meeting'}
        </Button>
      </header>

      <section>
        <SectionLabel>Talk time</SectionLabel>
        <TalkTime speakers={meeting.speakers} />
      </section>

      {insights.topics.length > 0 && (
        <section>
          <SectionLabel>Agenda as discussed</SectionLabel>
          <ol className="space-y-1 text-sm">
            {insights.topics.map((t, i) => (
              <li key={i} className="flex items-baseline gap-2">
                {t.startSec !== null ? (
                  <Timestamp
                    sec={t.startSec}
                    label={formatTime(t.startSec)}
                    onClick={() => onSeek(t.startSec!)}
                  />
                ) : (
                  <span className="w-11" />
                )}
                <span>{t.title}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section>
        <SectionLabel>Decisions</SectionLabel>
        {insights.decisions.length ? (
          <ul className="space-y-2">
            {insights.decisions.map((d, i) => (
              <li
                key={i}
                className="rounded-lg border-l-2 border-accent bg-accent-soft/60 px-3 py-2"
              >
                <p className="text-sm">{d.text}</p>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-muted">
                  {d.madeBy && <span>{d.madeBy}</span>}
                  {d.atSec !== null && (
                    <Timestamp
                      sec={d.atSec}
                      label={formatTime(d.atSec)}
                      onClick={() => onSeek(d.atSec!)}
                    />
                  )}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted">No decisions recorded.</p>
        )}
      </section>

      <section>
        <SectionLabel>Action items</SectionLabel>
        {actionItems.length ? (
          <ul>
            {actionItems.map((a) => (
              <ActionRow key={a.id} item={a} onJump={(item) => onSeek(item.atSec!)} />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted">No action items recorded.</p>
        )}
      </section>

      {insights.openQuestions.length > 0 && (
        <section>
          <SectionLabel>Left open</SectionLabel>
          <ul className="space-y-1.5 text-sm">
            {insights.openQuestions.map((q, i) => (
              <li key={i} className="flex gap-2">
                <HelpCircle className="mt-0.5 size-3.5 shrink-0 text-amber" /> {q}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionLabel
          action={
            <span className="inline-flex items-center gap-1 text-[11px] text-muted">
              <MessageSquareText className="size-3" /> {meeting.utterances.length} turns
            </span>
          }
        >
          Transcript
        </SectionLabel>
        <Transcript utterances={meeting.utterances} focus={focus} onSeek={onSeek} />
      </section>
    </div>
  );
}
