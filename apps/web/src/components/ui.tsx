import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { initials, speakerColor } from '../lib/format';

type Variant = 'primary' | 'ghost' | 'outline';

export function Button({
  variant = 'outline',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-accent text-accent-ink hover:opacity-90',
        variant === 'outline' && 'border border-line bg-surface hover:bg-sunken',
        variant === 'ghost' && 'text-muted hover:bg-sunken hover:text-ink',
        className,
      )}
      {...props}
    />
  );
}

export function IconButton({
  label,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        'grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40',
        className,
      )}
      {...props}
    />
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('size-4 animate-spin', className)} aria-hidden />;
}

export function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function MeetingBadge({ number, className }: { number: number; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex h-5 min-w-7 items-center justify-center rounded-md bg-sunken px-1.5 font-mono text-[11px] font-semibold text-ink',
        className,
      )}
    >
      #{number}
    </span>
  );
}

export function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  return (
    <span
      title={name}
      style={{ backgroundColor: speakerColor(name) }}
      className={clsx(
        'inline-grid shrink-0 place-items-center rounded-full font-semibold text-paper ring-2 ring-surface',
        size === 'sm' ? 'size-5 text-[9px]' : 'size-7 text-[11px]',
      )}
    >
      {size === 'sm' ? initials(name).slice(0, 1) : initials(name)}
    </span>
  );
}

export function AvatarStack({ names, max = 4 }: { names: string[]; max?: number }) {
  return (
    <span className="flex -space-x-1.5">
      {names.slice(0, max).map((n) => (
        <Avatar key={n} name={n} />
      ))}
      {names.length > max && (
        <span className="inline-grid size-5 place-items-center rounded-full bg-sunken text-[9px] text-muted ring-2 ring-surface">
          +{names.length - max}
        </span>
      )}
    </span>
  );
}

export function Timestamp({
  sec,
  label,
  onClick,
}: {
  sec: number;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="rounded px-1 font-mono text-[11px] text-accent tabular-nums hover:bg-accent-soft disabled:pointer-events-none disabled:text-muted"
      aria-label={`Jump to ${label}`}
      data-sec={sec}
    >
      {label}
    </button>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
      {children}
    </p>
  );
}
