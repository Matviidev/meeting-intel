import { z } from 'zod';

export interface Utterance {
  index: number;
  start: number;
  speaker: string;
  text: string;
}

export interface SpeakerStat {
  name: string;
  turns: number;
  words: number;
  share: number;
}

export const insightsSchema = z.object({
  title: z.string().describe('Short descriptive meeting title, e.g. "Checkout redesign kickoff"'),
  occurredOn: z
    .string()
    .nullable()
    .describe('Meeting date as YYYY-MM-DD if stated in the transcript, otherwise null'),
  summary: z.string().describe('Three to five sentence neutral summary of the meeting'),
  topics: z
    .array(z.object({ title: z.string(), startSec: z.number().int().nullable() }))
    .describe('Main discussion topics in order, with the second the topic starts'),
  decisions: z
    .array(
      z.object({
        text: z.string().describe('The decision, stated as an outcome'),
        madeBy: z.string().nullable(),
        atSec: z.number().int().nullable(),
      }),
    )
    .describe('Decisions explicitly agreed in the meeting, not proposals'),
  actionItems: z
    .array(
      z.object({
        owner: z.string().nullable().describe('Speaker name who owns the task'),
        task: z.string(),
        due: z.string().nullable().describe('Due date or timeframe exactly as said'),
        atSec: z.number().int().nullable(),
      }),
    )
    .describe('Tasks someone committed to or was assigned'),
  openQuestions: z.array(z.string()).describe('Questions raised but left unresolved'),
});

export type Insights = z.infer<typeof insightsSchema>;
