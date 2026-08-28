import { grokInstallGuidance, GROK_CLI_DOCS_URL } from "../shared/grok-install";
import { GrokMark } from "./icons";

export function CliSetupView({
  platform,
  error,
  onRetry,
  onOpenDocs,
  onCopyCommand,
}: {
  readonly platform: string;
  readonly error: string | null;
  readonly onRetry: () => void;
  readonly onOpenDocs: (url: string) => void;
  readonly onCopyCommand: (command: string) => void;
}) {
  const guidance = grokInstallGuidance(platform);

  return (
    <div className="shell shell--signin">
      <div className="sign-in" data-testid="cli-setup-view">
        <div className="sign-in__logo">
          <GrokMark />
        </div>
        <div className="sign-in__eyebrow">Grok Build</div>
        <h1>Install Grok CLI</h1>
        <p>
          This desktop shell needs the official Grok CLI. On {guidance.osLabel}, run this in{" "}
          {guidance.shell}, then come back and click Recheck.
        </p>
        {error ? <div className="sign-in__error">{error}</div> : null}
        <button
          className="sign-in__command"
          type="button"
          title="Copy install command"
          data-testid="cli-setup-command"
          onClick={() => onCopyCommand(guidance.command)}
        >
          {guidance.command}
        </button>
        <div className="sign-in__actions">
          <button className="button button--primary" type="button" onClick={() => onCopyCommand(guidance.command)}>
            Copy command
          </button>
          <button className="button button--secondary" type="button" onClick={onRetry}>
            Recheck
          </button>
        </div>
        <ul className="sign-in__notes">
          {guidance.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <button className="sign-in__console" type="button" onClick={() => onOpenDocs(GROK_CLI_DOCS_URL)}>
          Grok CLI install docs
        </button>
      </div>
    </div>
  );
}
