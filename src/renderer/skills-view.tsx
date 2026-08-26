import { useMemo, useState } from "react";
import type { AppSnapshot, CreateSkillInput, SkillRecord } from "../shared/protocol";
import { RefreshIcon } from "./icons";
import { ManageDialog } from "./manage-dialog";

const SKILL_NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export function SkillsView({
  state,
  onTrySkill,
  onAskGrokCreate,
}: {
  readonly state: AppSnapshot;
  readonly onTrySkill: (skill: SkillRecord) => void;
  readonly onAskGrokCreate: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | undefined>();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const skills = state.skills;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter((skill) =>
      [skill.name, skill.description ?? "", skill.source, skill.slashCommand].some((value) =>
        value.toLowerCase().includes(q),
      ),
    );
  }, [query, skills]);
  const active =
    filtered.find((skill) => skillKey(skill) === selected) ??
    filtered.find((skill) => skill.name === selected) ??
    filtered[0];

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="canvas">
      <div className="conversation skills-view">
        <header className="view-header">
          <div>
            <h1 className="view-header__title">Skills</h1>
            <p className="view-header__body">
              Give Grok workspace-specific capabilities and reusable workflows. Skills load from this folder and
              `~/.grok/skills`.
            </p>
          </div>
          <div className="view-header__actions">
            <button className="button button--secondary" type="button" disabled={busy} onClick={() => void window.grokApp.refresh()}>
              <RefreshIcon />
              <span>Refresh</span>
            </button>
            <button className="button button--primary" type="button" onClick={() => setCreating(true)}>
              New skill
            </button>
          </div>
        </header>

        {error ? <div className="error-banner">{error}</div> : null}

        <div className="skills-toolbar">
          <input
            aria-label="Search skills"
            className="skills-search"
            placeholder="Search skills"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="skills-layout">
          <div className="skills-grid" data-testid="skills-list">
            {filtered.length === 0 ? (
              <div className="empty-state">
                <h2>No skills found</h2>
                <p>Create a skill for this workspace, or refresh after adding one on disk.</p>
                <button className="button button--primary" type="button" onClick={() => setCreating(true)}>
                  New skill
                </button>
              </div>
            ) : (
              filtered.map((skill) => (
                <button
                  className={`skill-card ${active && skillKey(skill) === skillKey(active) ? "skill-card--active" : ""}`}
                  key={skillKey(skill)}
                  type="button"
                  onClick={() => {
                    setSelected(skillKey(skill));
                    setConfirmDelete(false);
                    setError(undefined);
                  }}
                >
                  <span className="skill-card__title-row">
                    <span className="skill-card__title">{titleCase(skill.name)}</span>
                    <span className={`skill-card__badge ${skill.enabled !== false ? "skill-card__badge--enabled" : ""}`}>
                      {skill.enabled === false ? "Disabled" : "Enabled"}
                    </span>
                  </span>
                  <span className="skill-card__description">{skill.description || "No description"}</span>
                  <span className="skill-card__meta">
                    <span>{skill.source}</span>
                    <span>{skill.slashCommand || `/${skill.name}`}</span>
                    {skill.disableModelInvocation ? <span>slash only</span> : null}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="skill-detail">
            {active ? (
              <>
                <div className="skill-detail__header">
                  <div>
                    <h2>{titleCase(active.name)}</h2>
                    <div className="skill-detail__slash">{active.slashCommand || `/${active.name}`}</div>
                  </div>
                  <span className={`skill-detail__status ${active.enabled !== false ? "skill-detail__status--enabled" : ""}`}>
                    {active.enabled === false ? "Disabled" : "Enabled"}
                  </span>
                </div>
                <p className="skill-detail__description">{active.description || "No description"}</p>
                <div className="skill-detail__meta-list">
                  <div>
                    <div className="skill-detail__meta-label">Source</div>
                    <div className="skill-detail__description">{active.source}</div>
                  </div>
                  {active.filePath ? (
                    <div>
                      <div className="skill-detail__meta-label">Path</div>
                      <div className="skill-detail__path">{active.filePath}</div>
                    </div>
                  ) : null}
                </div>
                <div className="skill-detail__actions">
                  {active.filePath ? (
                    <button
                      className="button button--secondary"
                      type="button"
                      onClick={() => void window.grokApp.openPath(skillFolder(active.filePath!))}
                    >
                      Open folder
                    </button>
                  ) : null}
                  <button
                    className="button button--secondary"
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => window.grokApp.setSkillEnabled(active.name, active.enabled === false))}
                  >
                    {active.enabled === false ? "Enable" : "Disable"}
                  </button>
                  {active.manageable && active.filePath ? (
                    confirmDelete ? (
                      <>
                        <button
                          className="button button--secondary"
                          type="button"
                          disabled={busy}
                          onClick={() => setConfirmDelete(false)}
                        >
                          Cancel
                        </button>
                        <button
                          className="button button--primary"
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await window.grokApp.deleteSkill(active.filePath!);
                              setConfirmDelete(false);
                              setSelected(undefined);
                            })
                          }
                        >
                          Delete skill
                        </button>
                      </>
                    ) : (
                      <button className="button button--secondary" type="button" disabled={busy} onClick={() => setConfirmDelete(true)}>
                        Delete
                      </button>
                    )
                  ) : null}
                  <button className="button button--primary" type="button" onClick={() => onTrySkill(active)}>
                    Try
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <h2>No skills found</h2>
                <p>Refresh discovery to load workspace, user, and bundled skills.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      {creating ? (
        <CreateSkillDialog
          hasWorkspace={Boolean(state.cwd)}
          onClose={() => setCreating(false)}
          onAskGrok={() => {
            setCreating(false);
            onAskGrokCreate();
          }}
          onCreate={async (input) => {
            const created = await window.grokApp.createSkill(input);
            setSelected(skillKey(created));
            setCreating(false);
          }}
        />
      ) : null}
    </section>
  );
}

function CreateSkillDialog({
  hasWorkspace,
  onClose,
  onCreate,
  onAskGrok,
}: {
  readonly hasWorkspace: boolean;
  readonly onClose: () => void;
  readonly onCreate: (input: CreateSkillInput) => Promise<void>;
  readonly onAskGrok: () => void;
}) {
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"project" | "user">(hasWorkspace ? "project" : "user");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const normalized = name.trim().toLowerCase();

  const submit = async () => {
    if (!SKILL_NAME_RE.test(normalized) || normalized.length < 2) {
      setError("Use 2–64 characters: lowercase letters, digits, and hyphens.");
      return;
    }
    if (!description.trim()) {
      setError("Add a description so Grok knows when to invoke this skill.");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await onCreate({ name: normalized, description: description.trim(), body: body.trim() || undefined, scope });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ManageDialog
      eyebrow="New skill"
      title="Create a skill"
      error={error}
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <button className="button button--secondary" type="button" disabled={busy} onClick={onAskGrok}>
            Ask Grok to write it
          </button>
          <button className="button button--secondary" type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="button button--primary" type="button" disabled={busy} onClick={() => void submit()}>
            {busy ? "Creating…" : "Create skill"}
          </button>
        </>
      }
    >
      <label className="settings-field">
        Name
        <input
          className="settings-text-input"
          value={name}
          spellCheck={false}
          placeholder="review-pr"
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <div className="new-thread__environment-group" role="radiogroup" aria-label="Skill scope">
        <button
          type="button"
          className={`new-thread__environment ${scope === "project" ? "new-thread__environment--active" : ""}`}
          aria-pressed={scope === "project"}
          disabled={!hasWorkspace}
          onClick={() => setScope("project")}
        >
          <span>Project</span>
        </button>
        <button
          type="button"
          className={`new-thread__environment ${scope === "user" ? "new-thread__environment--active" : ""}`}
          aria-pressed={scope === "user"}
          onClick={() => setScope("user")}
        >
          <span>User</span>
        </button>
      </div>
      <p className="skill-detail__description">
        {scope === "user"
          ? "Saved to ~/.grok/skills and available in every project."
          : "Saved to this workspace’s .grok/skills folder so teammates can share it."}
      </p>
      <label className="settings-field">
        Description
        <textarea
          className="manage-dialog__textarea"
          rows={3}
          placeholder="What it does, and when Grok should use it."
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <label className="settings-field">
        Instructions
        <textarea
          className="manage-dialog__textarea"
          rows={6}
          placeholder="Optional step-by-step instructions. You can leave this blank and edit SKILL.md later."
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
      </label>
    </ManageDialog>
  );
}

function skillKey(skill: SkillRecord): string {
  return skill.filePath || `${skill.source}:${skill.name}`;
}

function skillFolder(filePath: string): string {
  return filePath.replace(/[/\\]SKILL\.md$/i, "") || filePath;
}

function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}
