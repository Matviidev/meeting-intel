import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { citationLabel, linkCitations } from '../lib/citations';

export function Answer({
  content,
  streaming,
  known,
  onCite,
}: {
  content: string;
  streaming: boolean;
  known: Set<string>;
  onCite: (label: string) => void;
}) {
  return (
    <div className={streaming ? 'prose-answer streaming-caret' : 'prose-answer'}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            const label = citationLabel(href);
            if (!label) {
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent underline underline-offset-2"
                >
                  {children}
                </a>
              );
            }
            const valid = known.has(label);
            return (
              <button
                type="button"
                onClick={() => onCite(label)}
                title={
                  valid ? `Show source ${label}` : `${label} was not among the retrieved sources`
                }
                className={
                  valid
                    ? 'mx-0.5 inline-flex -translate-y-px items-center rounded bg-accent-soft px-1 font-mono text-[10px] font-semibold text-accent hover:bg-accent hover:text-accent-ink'
                    : 'mx-0.5 inline-flex -translate-y-px items-center rounded bg-bad-soft px-1 font-mono text-[10px] font-semibold text-bad line-through'
                }
              >
                {label}
              </button>
            );
          },
        }}
      >
        {linkCitations(content)}
      </ReactMarkdown>
    </div>
  );
}
