import type { AppSnapshot, FontScale, MonoFontId, ThemeMode, ThemePresetId, UiFontId } from "../shared/protocol";
import {
  FONT_SCALE_OPTIONS,
  MONO_FONT_OPTIONS,
  UI_FONT_OPTIONS,
} from "../shared/fonts";
import { permissionLabel } from "./composer-panel";
import { themePresets } from "./theme-presets";

export type SettingsSection = "general" | "appearance" | "models" | "providers";

export const SETTINGS_NAV = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "models", label: "Models" },
  { id: "providers", label: "Providers" },
] as const;

export function SettingsView({
  state,
  section,
  onSetThemeMode,
  onSetThemePreset,
  onSetTransparency,
  onSetUiFont,
  onSetMonoFont,
  onSetFontScale,
}: {
  readonly state: AppSnapshot;
  readonly section: SettingsSection;
  readonly onSetThemeMode: (mode: ThemeMode) => void;
  readonly onSetThemePreset: (id: ThemePresetId) => void;
  readonly onSetTransparency: (enabled: boolean) => void;
  readonly onSetUiFont: (id: UiFontId) => void;
  readonly onSetMonoFont: (id: MonoFontId) => void;
  readonly onSetFontScale: (scale: FontScale) => void;
}) {
  return (
    <section className="canvas">
      <div className="conversation settings-view">
        <header className="view-header">
          <div>
            <h1 className="view-header__title">{sectionTitle(section)}</h1>
            <p className="view-header__body">{sectionDescription(section)}</p>
          </div>
        </header>
        <div className="settings-grid">
          {section === "general" ? <GeneralSection state={state} /> : null}
          {section === "appearance" ? (
            <AppearanceSection
              themeMode={state.gui.themeMode ?? "system"}
              themePresetId={state.gui.themePresetId ?? "default"}
              enableTransparency={Boolean(state.gui.enableTransparency)}
              uiFontId={state.gui.uiFontId ?? "system"}
              monoFontId={state.gui.monoFontId ?? "system"}
              fontScale={state.gui.fontScale ?? 100}
              onSetThemeMode={onSetThemeMode}
              onSetThemePreset={onSetThemePreset}
              onSetTransparency={onSetTransparency}
              onSetUiFont={onSetUiFont}
              onSetMonoFont={onSetMonoFont}
              onSetFontScale={onSetFontScale}
            />
          ) : null}
          {section === "models" ? <ModelsSection state={state} /> : null}
          {section === "providers" ? <ProvidersSection state={state} /> : null}
        </div>
      </div>
    </section>
  );
}

function sectionTitle(section: SettingsSection): string {
  if (section === "appearance") return "Appearance";
  if (section === "models") return "Models";
  if (section === "providers") return "Providers";
  return "General";
}

function sectionDescription(section: SettingsSection): string {
  if (section === "appearance") return "Theme mode, color presets, fonts, and window chrome.";
  if (section === "models") return "Choose the default Grok model and reasoning effort for new threads.";
  if (section === "providers") return "Connect the Grok CLI the same way pi-gui connects model providers.";
  return "Grok CLI, auth, and workspace used by this desktop shell.";
}

function GeneralSection({ state }: { readonly state: AppSnapshot }) {
  return (
    <div className="settings-section">
      <div className="settings-group">
        <div className="settings-row">
          <div className="settings-row__label">
            <div className="settings-row__title">Binary</div>
            <div className="settings-row__description">The grok agent executable this shell talks to.</div>
          </div>
          <div className="settings-row__value">{state.grokBin ?? "not found"}</div>
        </div>
        <div className="settings-row">
          <div className="settings-row__label">
            <div className="settings-row__title">Version</div>
          </div>
          <div className="settings-row__value">{state.grokVersion ?? "unknown"}</div>
        </div>
        <div className="settings-row">
          <div className="settings-row__label">
            <div className="settings-row__title">Workspace</div>
          </div>
          <div className="settings-row__value">{state.cwd || "No folder open"}</div>
        </div>
        <div className="settings-row">
          <div className="settings-row__label">
            <div className="settings-row__title">Permission</div>
            <div className="settings-row__description">How tool calls are approved in this session.</div>
          </div>
          <div className="settings-row__value">{permissionLabel(state.permissionMode)}</div>
        </div>
        <div className="settings-row">
          <div className="settings-row__label">
            <div className="settings-row__title">Connection</div>
          </div>
          <div className="settings-row__value">{state.connected ? "ACP live" : "disconnected"}</div>
        </div>
        <div className="settings-row">
          <div className="settings-row__label">
            <div className="settings-row__title">Open folder</div>
            <div className="settings-row__description">Change the workspace used for new threads.</div>
          </div>
          <div className="settings-row__actions">
            <button className="button button--secondary" type="button" onClick={() => void window.grokApp.pickFolder()}>
              Open folder
            </button>
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-row__label">
            <div className="settings-row__title">Show thoughts</div>
            <div className="settings-row__description">Include the agent’s thinking blocks in the transcript.</div>
          </div>
          <label className="settings-toggle settings-toggle--inline">
            <input
              type="checkbox"
              checked={state.gui.showThoughts !== false}
              onChange={(event) => void window.grokApp.setGui({ showThoughts: event.target.checked })}
            />
            <span>Enable</span>
          </label>
        </div>
        <div className="settings-row">
          <div className="settings-row__label">
            <div className="settings-row__title">Notify when a run finishes</div>
            <div className="settings-row__description">Show an OS notification after an agent turn completes in the background.</div>
          </div>
          <label className="settings-toggle settings-toggle--inline">
            <input
              type="checkbox"
              checked={state.gui.notifyOnComplete !== false}
              onChange={(event) => void window.grokApp.setGui({ notifyOnComplete: event.target.checked })}
            />
            <span>Enable</span>
          </label>
        </div>
        <div className="settings-row">
          <div className="settings-row__label">
            <div className="settings-row__title">Notify when a run fails</div>
            <div className="settings-row__description">Show an OS notification if the agent errors while the window is unfocused.</div>
          </div>
          <label className="settings-toggle settings-toggle--inline">
            <input
              type="checkbox"
              checked={state.gui.notifyOnFailure !== false}
              onChange={(event) => void window.grokApp.setGui({ notifyOnFailure: event.target.checked })}
            />
            <span>Enable</span>
          </label>
        </div>
      </div>
    </div>
  );
}

function AppearanceSection({
  themeMode,
  themePresetId,
  enableTransparency,
  uiFontId,
  monoFontId,
  fontScale,
  onSetThemeMode,
  onSetThemePreset,
  onSetTransparency,
  onSetUiFont,
  onSetMonoFont,
  onSetFontScale,
}: {
  readonly themeMode: ThemeMode;
  readonly themePresetId: ThemePresetId;
  readonly enableTransparency: boolean;
  readonly uiFontId: UiFontId;
  readonly monoFontId: MonoFontId;
  readonly fontScale: FontScale;
  readonly onSetThemeMode: (mode: ThemeMode) => void;
  readonly onSetThemePreset: (id: ThemePresetId) => void;
  readonly onSetTransparency: (enabled: boolean) => void;
  readonly onSetUiFont: (id: UiFontId) => void;
  readonly onSetMonoFont: (id: MonoFontId) => void;
  readonly onSetFontScale: (scale: FontScale) => void;
}) {
  return (
    <div className="settings-section">
      <div className="settings-group">
        <div className="settings-row">
          <div className="settings-row__label">
            <div className="settings-row__title">Theme</div>
            <div className="settings-row__description">Follow the system or lock light or dark.</div>
          </div>
          <div className="settings-pill-row">
            {(["system", "light", "dark"] as const).map((mode) => (
              <button
                key={mode}
                className={`settings-pill ${themeMode === mode ? "settings-pill--active" : ""}`}
                type="button"
                onClick={() => onSetThemeMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-row__label">
            <div className="settings-row__title">Transparency</div>
            <div className="settings-row__description">Blur the sidebar and composer against the desktop.</div>
          </div>
          <label className="settings-toggle settings-toggle--inline">
            <input type="checkbox" checked={enableTransparency} onChange={(e) => onSetTransparency(e.target.checked)} />
            <span>Enable</span>
          </label>
        </div>
      </div>
      <div className="settings-group">
        <div className="settings-row">
          <div className="settings-row__label">
            <div className="settings-row__title">Interface font</div>
            <div className="settings-row__description">Named fonts apply only if they are installed on this machine.</div>
          </div>
          <div className="settings-pill-row">
            {UI_FONT_OPTIONS.map((option) => (
              <button
                key={option.id}
                className={`settings-pill ${uiFontId === option.id ? "settings-pill--active" : ""}`}
                type="button"
                title={option.description}
                onClick={() => onSetUiFont(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-row__label">
            <div className="settings-row__title">Code font</div>
            <div className="settings-row__description">Used for the terminal, diffs, and inline code.</div>
          </div>
          <div className="settings-pill-row">
            {MONO_FONT_OPTIONS.map((option) => (
              <button
                key={option.id}
                className={`settings-pill ${monoFontId === option.id ? "settings-pill--active" : ""}`}
                type="button"
                title={option.description}
                onClick={() => onSetMonoFont(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-row__label">
            <div className="settings-row__title">Size</div>
            <div className="settings-row__description">Scales the whole shell, including the sidebar and composer.</div>
          </div>
          <div className="settings-pill-row">
            {FONT_SCALE_OPTIONS.map((option) => (
              <button
                key={option.id}
                className={`settings-pill ${fontScale === option.id ? "settings-pill--active" : ""}`}
                type="button"
                onClick={() => onSetFontScale(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="settings-group">
        <div className="theme-preset-grid">
          {themePresets.map((preset) => (
            <label
              key={preset.id}
              className={`theme-preset-card ${themePresetId === preset.id ? "theme-preset-card--active" : ""}`}
            >
              <input
                type="radio"
                name="theme-preset"
                checked={themePresetId === preset.id}
                onChange={() => onSetThemePreset(preset.id)}
              />
              <span className="theme-preset-card__preview">
                {preset.swatches.slice(0, 4).map((color) => (
                  <span key={color} className="theme-preset-card__swatch" style={{ background: color }} />
                ))}
              </span>
              <span className="theme-preset-card__body">
                <span className="theme-preset-card__title">{preset.name}</span>
                <span className="theme-preset-card__description">{preset.description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function ModelsSection({ state }: { readonly state: AppSnapshot }) {
  return (
    <div className="settings-section">
      <div className="settings-group">
        <div className="settings-row">
          <div className="settings-row__label">
            <div className="settings-row__title">Current model</div>
            <div className="settings-row__description">Used for the active thread and new sessions.</div>
          </div>
          <div className="settings-row__value">{state.currentModelId || "none"}</div>
        </div>
        <div className="settings-row">
          <div className="settings-row__label">
            <div className="settings-row__title">Thinking level</div>
            <div className="settings-row__description">Default reasoning effort for this session.</div>
          </div>
          <div className="settings-pill-row">
            {(state.models.find((model) => model.modelId === state.currentModelId)?.reasoningEfforts ?? [
              { id: "low", value: "low", label: "low" },
              { id: "medium", value: "medium", label: "medium" },
              { id: "high", value: "high", label: "high" },
              { id: "xhigh", value: "xhigh", label: "xhigh" },
            ]).map((effort) => (
              <button
                key={effort.id}
                className={`settings-pill ${state.effort === effort.value || state.effort === effort.id ? "settings-pill--active" : ""}`}
                type="button"
                onClick={() => void window.grokApp.setEffort(effort.value)}
              >
                {effort.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="settings-option-list">
        {state.models.map((model) => (
          <button
            key={model.modelId}
            className={`settings-option ${model.modelId === state.currentModelId ? "settings-option--active" : ""}`}
            type="button"
            onClick={() => void window.grokApp.setModel(model.modelId)}
          >
            <span className="settings-option__title">{model.name}</span>
            <span className="settings-option__meta">{model.description ?? model.modelId}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProvidersSection({ state }: { readonly state: AppSnapshot }) {
  return (
    <div className="settings-section">
      <div className="settings-group">
        <div className="settings-row">
          <div className="settings-row__label">
            <div className="settings-row__title">Grok</div>
            <div className="settings-row__description">
              {state.auth.signingIn
                ? "Waiting for Grok CLI login to finish in your browser."
                : state.auth.authenticated
                  ? state.auth.email ?? "Signed in"
                  : "Sign in with the Grok CLI so this shell can run sessions."}
              {state.auth.error ? ` ${state.auth.error}` : ""}
            </div>
          </div>
          <div className="settings-row__actions">
            <button
              className="button button--primary"
              type="button"
              disabled={Boolean(state.auth.signingIn)}
              onClick={() => void window.grokApp.login()}
            >
              {state.auth.signingIn
                ? "Signing in…"
                : state.auth.authenticated
                  ? "Re-authenticate"
                  : "Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
