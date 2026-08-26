import type { ReactNode } from "react";

export function SecondarySurface({
  title,
  items,
  activeId,
  onBack,
  onSelect,
  children,
}: {
  readonly title: string;
  readonly items: readonly { id: string; label: string }[];
  readonly activeId: string;
  readonly onBack: () => void;
  readonly onSelect: (id: string) => void;
  readonly children: ReactNode;
}) {
  return (
    <div className="secondary-surface">
      <aside className="secondary-surface__sidebar">
        <button className="secondary-surface__back" type="button" onClick={onBack}>
          ← Back
        </button>
        <div className="secondary-surface__title">{title}</div>
        <nav className="secondary-surface__nav">
          {items.map((item) => (
            <button
              key={item.id}
              className={`secondary-surface__nav-item ${item.id === activeId ? "secondary-surface__nav-item--active" : ""}`}
              type="button"
              onClick={() => onSelect(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <div className="secondary-surface__content">{children}</div>
    </div>
  );
}
