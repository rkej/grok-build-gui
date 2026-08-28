import { GrokMark } from "./icons";

const INSTALL_COMMAND_UNIX = "curl -fsSL https://x.ai/cli/install.sh | bash";
const INSTALL_COMMAND_WIN = "irm https://x.ai/cli/install.ps1 | iex";

export function CliSetupView({
  installing,
  error,
  onInstall,
  onRetry,
  onOpenDocs,
  onCopyCommand,
}: {
  readonly installing: boolean;
  readonly error: string | null;
  readonly onInstall: () => void;
  readonly onRetry: () => void;
  readonly onOpenDocs: () => void;
  readonly onCopyCommand: (command: string) => void;
}) {
  const win = typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent);
  const command = win ? INSTALL_COMMAND_WIN : INSTALL_COMMAND_UNIX;

  return (
    <div className="shell shell--signin">
      <div className="sign-in" data-testid="cli-setup-view">
        <div className="sign-in__logo">
          <GrokMark />
        </div>
        <div className="sign-in__eyebrow">Grok Build</div>
        <h1>Install Grok CLI</h1>
        <p>
          This desktop shell talks to the Grok CLI. Install it once, then this window can sign in and
          start threads.
        </p>
        {error ? <div className="sign-in__error">{error}</div> : null}
        <div className="sign-in__actions">
          <button
            className="button button--primary"
            type="button"
            disabled={installing}
            data-testid="cli-setup-install"
            onClick={onInstall}
          >
            {installing ? "Installing…" : "Install Grok CLI"}
          </button>
          <button className="button button--secondary" type="button" disabled={installing} onClick={onRetry}>
            Recheck
          </button>
        </div>
        <button
          className="sign-in__command"
          type="button"
          title="Copy install command"
          onClick={() => onCopyCommand(command)}
        >
          {command}
        </button>
        <button className="sign-in__console" type="button" onClick={onOpenDocs}>
          Installation docs
        </button>
      </div>
    </div>
  );
}
