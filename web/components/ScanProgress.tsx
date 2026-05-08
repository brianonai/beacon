"use client";

type Props = {
  completed: number;
  total: number;
  done: boolean;
  /** e.g. "Inspecting URLs" or "Checking pages (HTTP)" */
  title?: string;
};

export function ScanProgress({ completed, total, done, title = "Progress" }: Props) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-mono uppercase tracking-widest text-smoke">
          {done ? `${title} · complete` : title}
        </p>
        <p className="font-mono text-sm tabular-nums text-ash">
          {completed.toLocaleString()} / {total.toLocaleString()}
          <span className="ml-3 text-bone">{pct}%</span>
        </p>
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-rule">
        <div
          className="absolute inset-y-0 left-0 bg-beam transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
        {!done && (
          <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-sweep
                          bg-gradient-to-r from-transparent via-beam2/40 to-transparent" />
        )}
      </div>
    </div>
  );
}
