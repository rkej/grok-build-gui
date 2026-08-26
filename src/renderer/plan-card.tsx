import { useState } from "react";
import type { PlanEntry, PlanState } from "../shared/protocol";
import { planProgress } from "../shared/plan";

export function PlanCard({
  entries,
  compact = false,
}: {
  readonly entries: readonly PlanEntry[];
  readonly compact?: boolean;
}) {
  const [open, setOpen] = useState(!compact);
  const progress = planProgress([...entries]);
  if (!entries.length) return null;
  const currentLabel = progress.current?.content ?? (progress.pct === 100 ? "All tasks complete" : "Waiting for next task");
  const countLabel = `${progress.done}/${progress.total} complete${progress.cancelled ? ` · ${progress.cancelled} cancelled` : ""}`;

  return (
    <article className={`plan-card ${compact ? "plan-card--compact" : ""}`} data-testid="plan-card">
      <button
        className="plan-card__header"
        type="button"
        aria-expanded={open}
        aria-label={`${countLabel}. ${open ? "Hide" : "Show"} plan tasks`}
        onClick={() => setOpen((value) => !value)}
      >
        <div className="plan-card__eyebrow">
          <span className="plan-card__title"><span className="plan-card__title-icon" aria-hidden="true">☷</span>Plan</span>
          <span className="plan-card__count">{countLabel}</span>
        </div>
        <div className="plan-card__bar" aria-hidden="true">
          <span className="plan-card__fill" style={{ width: `${progress.pct}%` }} />
        </div>
        <div className="plan-card__current">
          <span className={`plan-card__current-status ${progress.current?.status ?? (progress.pct === 100 ? "completed" : "pending")}`} aria-hidden="true">
            {progress.current?.status === "in_progress" ? "▶" : progress.pct === 100 ? "✓" : "□"}
          </span>
          <span className="plan-card__current-state">
            {progress.current?.status === "in_progress" ? "In progress" : progress.pct === 100 ? "Complete" : "Next"}
          </span>
          <span className="plan-card__current-text">{currentLabel}</span>
        </div>
      </button>
      {open ? (
        <ol className="plan-card__steps">
          {entries.map((entry, index) => (
            <li key={entry.id ?? `${entry.content}:${index}`} className={`plan-card__step plan-card__step--${entry.status}`}>
              <span className="plan-card__pip" aria-hidden="true">
                {entry.status === "completed" ? "✓" : entry.status === "in_progress" ? "▶" : entry.status === "cancelled" ? "×" : "□"}
              </span>
              <span className="plan-card__step-body">
                <span className="plan-card__step-text">{entry.content}</span>
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </article>
  );
}

export function PlanStrip({ plan }: { readonly plan: PlanState }) {
  if (!plan?.entries?.length || plan.status === "complete") return null;
  const progress = planProgress(plan.entries);
  if (progress.pct === 100 || progress.total === 0) return null;
  return <PlanCard entries={plan.entries} compact />;
}
