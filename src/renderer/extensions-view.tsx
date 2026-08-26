import { useMemo, useState } from "react";
import type { AddMcpInput, AppSnapshot, McpServerRecord, PluginRecord } from "../shared/protocol";
import { RefreshIcon } from "./icons";
import { ManageDialog } from "./manage-dialog";

export type ExtensionsSection = "mcp" | "plugins";

export function ExtensionsView({
  state,
  section,
}: {
  readonly state: AppSnapshot;
  readonly section: ExtensionsSection;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | undefined>();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [confirmRemove, setConfirmRemove] = useState(false);

  const servers = state.mcp;
  const plugins = state.plugins;
  const filteredServers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return servers;
    return servers.filter((ext) =>
      [ext.name, ext.displayName ?? "", ext.status ?? "", ext.source ?? "", ext.command ?? "", ext.url ?? ""].some((value) =>
        value.toLowerCase().includes(q),
      ),
    );
  }, [query, servers]);
  const filteredPlugins = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return plugins;
    return plugins.filter((plugin) =>
      [plugin.name, plugin.description ?? "", plugin.source ?? "", plugin.version ?? ""].some((value) =>
        value.toLowerCase().includes(q),
      ),
    );
  }, [plugins, query]);

  const activeServer = filteredServers.find((ext) => ext.name === selected) ?? filteredServers[0];
  const activePlugin = filteredPlugins.find((plugin) => plugin.name === selected) ?? filteredPlugins[0];

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
            <h1 className="view-header__title">{section === "plugins" ? "Plugins" : "MCP servers"}</h1>
            <p className="view-header__body">
              {section === "plugins"
                ? "Install marketplace plugins that bundle skills, hooks, and MCP servers. No CLI required."
                : "Inspect and manage MCP servers for this workspace. Add stdio or HTTP servers without leaving the app."}
            </p>
          </div>
          <div className="view-header__actions">
            <button className="button button--secondary" type="button" disabled={busy} onClick={() => void window.grokApp.refresh()}>
              <RefreshIcon />
              <span>Refresh</span>
            </button>
            <button
              className="button button--primary"
              type="button"
              onClick={() => {
                setAdding(true);
                setError(undefined);
              }}
            >
              {section === "plugins" ? "Install plugin" : "Add server"}
            </button>
          </div>
        </header>

        {error ? <div className="error-banner">{error}</div> : null}

        <div className="skills-toolbar">
          <input
            aria-label={section === "plugins" ? "Search plugins" : "Search extensions"}
            className="skills-search"
            placeholder={section === "plugins" ? "Search plugins" : "Search MCP servers"}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        {section === "plugins" ? (
          <PluginList
            plugins={filteredPlugins}
            active={activePlugin}
            busy={busy}
            confirmRemove={confirmRemove}
            onSelect={(name) => {
              setSelected(name);
              setConfirmRemove(false);
              setError(undefined);
            }}
            onToggle={(plugin, enabled) => void run(() => window.grokApp.setPluginEnabled(plugin.name, enabled))}
            onOpen={(plugin) => {
              if (plugin.path) void window.grokApp.openPath(plugin.path);
            }}
            onAskRemove={() => setConfirmRemove(true)}
            onCancelRemove={() => setConfirmRemove(false)}
            onRemove={(plugin) =>
              void run(async () => {
                await window.grokApp.uninstallPlugin(plugin.name);
                setConfirmRemove(false);
                setSelected(undefined);
              })
            }
          />
        ) : (
          <McpList
            servers={filteredServers}
            active={activeServer}
            busy={busy}
            confirmRemove={confirmRemove}
            onSelect={(name) => {
              setSelected(name);
              setConfirmRemove(false);
              setError(undefined);
            }}
            onToggle={(server, enabled) => void run(() => window.grokApp.setMcpEnabled(server.name, enabled))}
            onAskRemove={() => setConfirmRemove(true)}
            onCancelRemove={() => setConfirmRemove(false)}
            onRemove={(server) =>
              void run(async () => {
                await window.grokApp.removeMcp(server.name, server.scope === "project" ? "project" : "user");
                setConfirmRemove(false);
                setSelected(undefined);
              })
            }
          />
        )}
      </div>
      {adding && section === "mcp" ? (
        <AddMcpDialog
          onClose={() => setAdding(false)}
          onAdd={async (input) => {
            await window.grokApp.addMcp(input);
            setSelected(input.name);
            setAdding(false);
          }}
        />
      ) : null}
      {adding && section === "plugins" ? (
        <InstallPluginDialog
          onClose={() => setAdding(false)}
          onInstall={async (source, trust) => {
            await window.grokApp.installPlugin(source, trust);
            setAdding(false);
          }}
        />
      ) : null}
    </section>
  );
}

function McpList({
  servers,
  active,
  busy,
  confirmRemove,
  onSelect,
  onToggle,
  onAskRemove,
  onCancelRemove,
  onRemove,
}: {
  readonly servers: readonly McpServerRecord[];
  readonly active?: McpServerRecord;
  readonly busy: boolean;
  readonly confirmRemove: boolean;
  readonly onSelect: (name: string) => void;
  readonly onToggle: (server: McpServerRecord, enabled: boolean) => void;
  readonly onAskRemove: () => void;
  readonly onCancelRemove: () => void;
  readonly onRemove: (server: McpServerRecord) => void;
}) {
  return (
    <div className="skills-layout">
      <div className="skills-grid" data-testid="extensions-list">
        {servers.length === 0 ? (
          <div className="empty-state">
            <h2>No MCP servers found</h2>
            <p>Add a stdio or HTTP server here. Grok will write it to config.toml.</p>
          </div>
        ) : (
          servers.map((ext) => (
            <button
              className={`skill-card ${active?.name === ext.name ? "skill-card--active" : ""}`}
              key={ext.name}
              type="button"
              onClick={() => onSelect(ext.name)}
            >
              <span className="skill-card__title-row">
                <span className="skill-card__title">{ext.displayName ?? ext.name}</span>
                <span className={`skill-card__badge ${ext.enabled !== false ? "skill-card__badge--enabled" : ""}`}>
                  {ext.enabled === false ? "Disabled" : ext.status ?? "Enabled"}
                </span>
              </span>
              <span className="skill-card__description">{ext.url || ext.command || ext.source || "MCP server"}</span>
              <span className="skill-card__meta">
                <span>{ext.transport ?? "mcp"}</span>
                {ext.scope ? <span>{ext.scope}</span> : null}
                <span>{ext.name}</span>
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
                <h2>{active.displayName ?? active.name}</h2>
                <div className="skill-detail__slash">{active.source ?? active.transport ?? "MCP"}</div>
              </div>
              <span className={`skill-detail__status ${active.enabled !== false ? "skill-detail__status--enabled" : ""}`}>
                {active.enabled === false ? "Disabled" : active.status ?? "Enabled"}
              </span>
            </div>
            <div className="skill-detail__meta-list">
              <DetailItem label="Name" value={active.name} />
              <DetailItem label="Transport" value={active.transport ?? "unknown"} />
              {active.scope ? <DetailItem label="Scope" value={active.scope} /> : null}
              {active.command ? <DetailItem label="Command" value={active.command} mono /> : null}
              {active.url ? <DetailItem label="URL" value={active.url} mono /> : null}
              <DetailItem label="Source" value={active.source ?? "unknown"} />
            </div>
            <div className="skill-detail__actions">
              <button
                className="button button--secondary"
                type="button"
                disabled={busy}
                onClick={() => onToggle(active, active.enabled === false)}
              >
                {active.enabled === false ? "Enable" : "Disable"}
              </button>
              {confirmRemove ? (
                <>
                  <button className="button button--secondary" type="button" disabled={busy} onClick={onCancelRemove}>
                    Cancel
                  </button>
                  <button className="button button--primary" type="button" disabled={busy} onClick={() => onRemove(active)}>
                    Remove server
                  </button>
                </>
              ) : (
                <button className="button button--secondary" type="button" disabled={busy} onClick={onAskRemove}>
                  Remove
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <h2>No MCP servers found</h2>
            <p>Add a server to expose external tools to Grok.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PluginList({
  plugins,
  active,
  busy,
  confirmRemove,
  onSelect,
  onToggle,
  onOpen,
  onAskRemove,
  onCancelRemove,
  onRemove,
}: {
  readonly plugins: readonly PluginRecord[];
  readonly active?: PluginRecord;
  readonly busy: boolean;
  readonly confirmRemove: boolean;
  readonly onSelect: (name: string) => void;
  readonly onToggle: (plugin: PluginRecord, enabled: boolean) => void;
  readonly onOpen: (plugin: PluginRecord) => void;
  readonly onAskRemove: () => void;
  readonly onCancelRemove: () => void;
  readonly onRemove: (plugin: PluginRecord) => void;
}) {
  return (
    <div className="skills-layout">
      <div className="skills-grid" data-testid="plugins-list">
        {plugins.length === 0 ? (
          <div className="empty-state">
            <h2>No plugins installed</h2>
            <p>Install from GitHub (`owner/repo`), a git URL, or a local folder.</p>
          </div>
        ) : (
          plugins.map((plugin) => (
            <button
              className={`skill-card ${active?.name === plugin.name ? "skill-card--active" : ""}`}
              key={plugin.name}
              type="button"
              onClick={() => onSelect(plugin.name)}
            >
              <span className="skill-card__title-row">
                <span className="skill-card__title">{plugin.name}</span>
                <span className={`skill-card__badge ${plugin.enabled !== false ? "skill-card__badge--enabled" : ""}`}>
                  {plugin.enabled === false ? "Disabled" : "Enabled"}
                </span>
              </span>
              <span className="skill-card__description">{plugin.description || plugin.source || "Plugin"}</span>
              <span className="skill-card__meta">
                {plugin.version ? <span>{plugin.version}</span> : null}
                {plugin.source ? <span>{plugin.source}</span> : null}
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
                <h2>{active.name}</h2>
                <div className="skill-detail__slash">{active.source ?? "plugin"}</div>
              </div>
              <span className={`skill-detail__status ${active.enabled !== false ? "skill-detail__status--enabled" : ""}`}>
                {active.enabled === false ? "Disabled" : "Enabled"}
              </span>
            </div>
            {active.description ? <p className="skill-detail__description">{active.description}</p> : null}
            <div className="skill-detail__meta-list">
              {active.version ? <DetailItem label="Version" value={active.version} /> : null}
              {active.source ? <DetailItem label="Source" value={active.source} /> : null}
              {active.path ? <DetailItem label="Path" value={active.path} mono /> : null}
            </div>
            <div className="skill-detail__actions">
              {active.path ? (
                <button className="button button--secondary" type="button" onClick={() => onOpen(active)}>
                  Open folder
                </button>
              ) : null}
              <button
                className="button button--secondary"
                type="button"
                disabled={busy}
                onClick={() => onToggle(active, active.enabled === false)}
              >
                {active.enabled === false ? "Enable" : "Disable"}
              </button>
              {confirmRemove ? (
                <>
                  <button className="button button--secondary" type="button" disabled={busy} onClick={onCancelRemove}>
                    Cancel
                  </button>
                  <button className="button button--primary" type="button" disabled={busy} onClick={() => onRemove(active)}>
                    Uninstall plugin
                  </button>
                </>
              ) : (
                <button className="button button--secondary" type="button" disabled={busy} onClick={onAskRemove}>
                  Uninstall
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <h2>No plugins installed</h2>
            <p>Install a plugin to add skills, hooks, and MCP servers in one step.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailItem({ label, value, mono }: { readonly label: string; readonly value: string; readonly mono?: boolean }) {
  return (
    <div>
      <div className="skill-detail__meta-label">{label}</div>
      <div className={mono ? "skill-detail__path" : "skill-detail__description"}>{value}</div>
    </div>
  );
}

function AddMcpDialog({
  onClose,
  onAdd,
}: {
  readonly onClose: () => void;
  readonly onAdd: (input: AddMcpInput) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"user" | "project">("user");
  const [transport, setTransport] = useState<"stdio" | "http" | "sse">("stdio");
  const [command, setCommand] = useState("");
  const [url, setUrl] = useState("");
  const [envText, setEnvText] = useState("");
  const [headerText, setHeaderText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const submit = async () => {
    if (!/^[A-Za-z0-9_-]+$/.test(name.trim())) {
      setError("Names may only contain letters, numbers, hyphens, and underscores.");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await onAdd({
        name: name.trim(),
        scope,
        transport,
        command: transport === "stdio" ? command.trim() : undefined,
        url: transport === "stdio" ? undefined : url.trim(),
        env: parsePairs(envText),
        headers: parsePairs(headerText),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ManageDialog
      eyebrow="Extensions"
      title="Add MCP server"
      error={error}
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <button className="button button--secondary" type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="button button--primary" type="button" disabled={busy} onClick={() => void submit()}>
            {busy ? "Adding…" : "Add server"}
          </button>
        </>
      }
    >
      <label className="settings-field">
        Name
        <input className="settings-text-input" spellCheck={false} placeholder="github" value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <div className="new-thread__environment-group" role="radiogroup" aria-label="MCP scope">
        <ScopeButton label="User" active={scope === "user"} onClick={() => setScope("user")} />
        <ScopeButton label="Project" active={scope === "project"} onClick={() => setScope("project")} />
      </div>
      <div className="new-thread__environment-group" role="radiogroup" aria-label="Transport">
        <ScopeButton label="stdio" active={transport === "stdio"} onClick={() => setTransport("stdio")} />
        <ScopeButton label="HTTP" active={transport === "http"} onClick={() => setTransport("http")} />
        <ScopeButton label="SSE" active={transport === "sse"} onClick={() => setTransport("sse")} />
      </div>
      {transport === "stdio" ? (
        <label className="settings-field">
          Command
          <input
            className="settings-text-input"
            spellCheck={false}
            placeholder="npx -y @modelcontextprotocol/server-github"
            value={command}
            onChange={(event) => setCommand(event.target.value)}
          />
        </label>
      ) : (
        <label className="settings-field">
          URL
          <input
            className="settings-text-input"
            spellCheck={false}
            placeholder="https://mcp.example.com/mcp"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
        </label>
      )}
      {transport === "stdio" ? (
        <label className="settings-field">
          Environment (KEY=value, one per line)
          <textarea className="manage-dialog__textarea" rows={3} value={envText} onChange={(event) => setEnvText(event.target.value)} />
        </label>
      ) : (
        <label className="settings-field">
          Headers (Name: value, one per line)
          <textarea className="manage-dialog__textarea" rows={3} value={headerText} onChange={(event) => setHeaderText(event.target.value)} />
        </label>
      )}
    </ManageDialog>
  );
}

function InstallPluginDialog({
  onClose,
  onInstall,
}: {
  readonly onClose: () => void;
  readonly onInstall: (source: string, trust: boolean) => Promise<void>;
}) {
  const [source, setSource] = useState("");
  const [trust, setTrust] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const submit = async () => {
    if (!source.trim()) {
      setError("Enter owner/repo, a git URL, or a local path.");
      return;
    }
    if (!trust) {
      setError("Confirm you trust this source. Installing enables the plugin’s skills, hooks, and MCP servers.");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await onInstall(source.trim(), trust);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ManageDialog
      eyebrow="Plugins"
      title="Install a plugin"
      error={error}
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <button className="button button--secondary" type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="button button--primary" type="button" disabled={busy} onClick={() => void submit()}>
            {busy ? "Installing…" : "Install"}
          </button>
        </>
      }
    >
      <label className="settings-field">
        Source
        <input
          className="settings-text-input"
          spellCheck={false}
          placeholder="owner/repo, git URL, or /path/to/plugin"
          value={source}
          onChange={(event) => setSource(event.target.value)}
        />
      </label>
      <p className="skill-detail__description">
        Plugins run with your privileges. Only install sources you trust — the same warning Grok’s CLI shows before `--trust`.
      </p>
      <label className="settings-toggle settings-toggle--row">
        <input type="checkbox" checked={trust} onChange={(event) => setTrust(event.target.checked)} />
        I trust this source
      </label>
    </ManageDialog>
  );
}

function ScopeButton({ label, active, onClick }: { readonly label: string; readonly active: boolean; readonly onClick: () => void }) {
  return (
    <button
      type="button"
      className={`new-thread__environment ${active ? "new-thread__environment--active" : ""}`}
      aria-pressed={active}
      onClick={onClick}
    >
      <span>{label}</span>
    </button>
  );
}

function parsePairs(text: string): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const sep = trimmed.includes("=") && (!trimmed.includes(":") || trimmed.indexOf("=") < trimmed.indexOf(":")) ? "=" : ":";
    const at = trimmed.indexOf(sep);
    if (at <= 0) continue;
    const key = trimmed.slice(0, at).trim();
    const value = trimmed.slice(at + 1).trim();
    if (key) out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}
