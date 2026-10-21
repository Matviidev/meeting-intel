import clsx from 'clsx';
import { Check } from 'lucide-react';
import { useSetActionStatus } from '../hooks/queries';
import { formatTime } from '../lib/format';
import type { ActionItem } from '../lib/types';
import { Avatar, MeetingBadge, Timestamp } from './ui';

export function ActionRow({
  item,
  showMeeting,
  onJump,
}: {
  item: ActionItem;
  showMeeting?: boolean;
  onJump?: (item: ActionItem) => void;
}) {
  const setStatus = useSetActionStatus();
  const done = item.status === 'done';

  return (
    <li className="flex items-start gap-2.5 rounded-lg px-1 py-1.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`Mark "${item.task}" as ${done ? 'open' : 'done'}`}
        onClick={() => setStatus.mutate({ id: item.id, status: done ? 'open' : 'done' })}
        className={clsx(
          'mt-0.5 grid size-4 shrink-0 place-items-center rounded border transition-colors',
          done ? 'border-good bg-good text-paper' : 'border-line bg-surface hover:border-accent',
        )}
      >
        {done && <Check className="size-3" strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={clsx('text-sm', done && 'text-muted line-through')}>{item.task}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
          {item.owner ? (
            <span className="inline-flex items-center gap-1">
              <Avatar name={item.owner} /> {item.owner}
            </span>
          ) : (
            <span className="rounded bg-amber-soft px-1.5 text-amber">Unassigned</span>
          )}
          {item.due && <span>Due {item.due}</span>}
          {showMeeting && <MeetingBadge number={item.meetingNumber} />}
          {item.atSec !== null && (
            <Timestamp
              sec={item.atSec}
              label={formatTime(item.atSec)}
              onClick={onJump && (() => onJump(item))}
            />
          )}
        </div>
      </div>
    </li>
  );
}
