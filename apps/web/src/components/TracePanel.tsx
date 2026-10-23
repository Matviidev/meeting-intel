import { useTrace } from '../hooks/queries';
import type { ChatMessage } from '../lib/types';
import { ErrorNote, SectionLabel, Spinner } from './ui';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-sunken px-3 py-2">
      <p className="text-[10px] tracking-wide text-muted uppercase">{label}</p>
      <p className="tabular-nums text-sm">{value}</p>
    </div>
  );
}

const ms = (v: number | null) =>
  v === null ? '—' : v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${v}ms`;

export function TracePanel({ message }: { message: ChatMessage | undefined }) {
  const traceId = message?.meta?.traceId;
  const { data, isLoading, error } = useTrace(traceId, message?.status !== 'streaming');

  if (!traceId) {
    return (
      <div className="px-1 py-10 text-center text-sm text-muted">
        Each answer is traced: retrieval ranks, latency, tokens and guardrail flags.
      </div>
    );
  }
  if (message?.status === 'streaming' || isLoading)
    return <Spinner className="mx-auto mt-10 text-accent" />;
  if (error || !data) return <ErrorNote>Could not load the trace.</ErrorNote>;

  const scope = message?.meta?.scope;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Total latency" value={ms(data.latencyMs)} />
        <Stat label="First token" value={ms(data.firstTokenMs)} />
        <Stat label="Input tokens" value={data.inputTokens?.toLocaleString() ?? '—'} />
        <Stat label="Output tokens" value={data.outputTokens?.toLocaleString() ?? '—'} />
      </div>
      <div>
        <SectionLabel>Model & scope</SectionLabel>
        <p className="tabular-nums text-xs">{data.model}</p>
        <p className="mt-1 text-xs text-muted">
          {data.scope.length
            ? `Meetings ${data.scope.map((n) => `#${n}`).join(', ')}`
            : 'No meetings in scope'}{' '}
          · {scope?.reason}
          {scope?.speakers.length ? ` · speakers ${scope.speakers.join(', ')}` : ''}
        </p>
      </div>
      <div>
        <SectionLabel>Guardrail flags</SectionLabel>
        {data.flags.length ? (
          <ul className="flex flex-wrap gap-1">
            {data.flags.map((f) => (
              <li
                key={f}
                className="rounded-md bg-amber-soft px-2 py-0.5 tabular-nums text-[11px] text-amber"
              >
                {f}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted">None raised.</p>
        )}
      </div>
      <div>
        <SectionLabel>Hybrid retrieval (RRF)</SectionLabel>
        <table className="w-full text-xs">
          <thead className="text-left text-muted">
            <tr>
              <th className="py-1 font-medium">Chunk</th>
              <th className="py-1 font-medium">Time</th>
              <th className="py-1 text-right font-medium" title="Vector rank">
                Vec
              </th>
              <th className="py-1 text-right font-medium" title="Keyword rank">
                Kw
              </th>
              <th className="py-1 text-right font-medium" title="Speaker-filtered rank">
                Spk
              </th>
              <th className="py-1 text-right font-medium">Score</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {data.retrieved.map((r) => (
              <tr key={r.label} className="border-t border-line">
                <td className="py-1">{r.label}</td>
                <td className="py-1">{r.range}</td>
                <td className="py-1 text-right">{r.vectorRank ?? '—'}</td>
                <td className="py-1 text-right">{r.keywordRank ?? '—'}</td>
                <td className="py-1 text-right">{r.speakerRank ?? '—'}</td>
                <td className="py-1 text-right">{r.score.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
