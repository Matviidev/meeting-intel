export interface SpeakerStat {
  name: string;
  turns: number;
  words: number;
  share: number;
}

export interface Utterance {
  index: number;
  start: number;
  speaker: string;
  text: string;
}

export interface Insights {
  title: string;
  occurredOn: string | null;
  summary: string;
  topics: { title: string; startSec: number | null }[];
  decisions: { text: string; madeBy: string | null; atSec: number | null }[];
  actionItems: { owner: string | null; task: string; due: string | null; atSec: number | null }[];
  openQuestions: string[];
}

export interface Meeting {
  id: string;
  number: number;
  title: string;
  occurredOn: string | null;
  sourceName: string;
  durationSec: number;
  speakers: SpeakerStat[];
  summary: string;
  decisionCount: number;
  openActionCount: number;
  createdAt: string;
}

export interface ActionItem {
  id: string;
  meetingId: string;
  meetingNumber: number;
  meetingTitle: string;
  owner: string | null;
  task: string;
  due: string | null;
  atSec: number | null;
  status: 'open' | 'done';
}

export interface MeetingDetail {
  meeting: Meeting & { insights: Insights; utterances: Utterance[] };
  actionItems: ActionItem[];
}

export interface Source {
  label: string;
  meetingNumber: number;
  meetingTitle: string;
  startSec: number;
  endSec: number;
  speakers: string[];
  content: string;
}

export interface ChatMeta {
  traceId: string;
  scope: {
    reason: 'pinned' | 'mentioned' | 'all';
    meetings: number[];
    unknown: number[];
    speakers: string[];
  };
  sources: Source[];
  flags: string[];
}

export interface ChatDone {
  cited: string[];
  unknownCitations: string[];
  unverifiedAttributions: string[];
  flags: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status?: 'streaming' | 'done' | 'error';
  meta?: ChatMeta;
  done?: ChatDone;
  error?: string;
  feedback?: 1 | -1;
}

export interface Trace {
  id: string;
  question: string;
  scope: number[];
  retrieved: {
    label: string;
    range: string;
    score: number;
    vectorRank: number | null;
    keywordRank: number | null;
    speakerRank: number | null;
  }[];
  flags: string[];
  model: string;
  latencyMs: number | null;
  firstTokenMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  feedback: number | null;
  createdAt: string;
}
