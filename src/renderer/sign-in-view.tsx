import type { AuthState } from "../shared/protocol";
import { GrokMark } from "./icons";

export function SignInView({
  auth,
  connected,
  grokBin,
  grokVersion,
  bootError,
  onSignIn,
  onOpenUrl,
}: {
  readonly auth: AuthState;
  readonly connected: boolean;
  readonly grokBin: string | null;
  readonly grokVersion: string | null;
  readonly bootError: string | null;
  readonly onSignIn: () => void;
  readonly onOpenUrl: (url: string) => void;
}) {
  const error = auth.error || (!connected ? bootError : null);

  return (
    <div className="shell shell--signin">
      <div className="sign-in" data-testid="sign-in-view">
        <div className="sign-in__logo">
          <GrokMark />
        </div>
        <div className="sign-in__eyebrow">Grok Build</div>
        <h1>Sign in to Grok</h1>
        <p>This desktop shell uses your Grok CLI session. Sign in to continue.</p>
        {error ? <div className="sign-in__error">{error}</div> : null}
        <div className="sign-in__actions">
          <button
            className="button button--primary"
            type="button"
            data-testid="sign-in-submit"
            onClick={onSignIn}
          >
            {error ? "Try again" : "Sign in"}
          </button>
          {auth.loginUrl ? (
            <button
              className="button button--secondary"
              type="button"
              onClick={() => onOpenUrl(auth.loginUrl!)}
            >
              Open browser
            </button>
          ) : null}
        </div>
        <div className="sign-in__meta">
          {grokBin ? <span>{grokBin}</span> : <span>Grok CLI not found</span>}
          {grokVersion ? <span>{grokVersion}</span> : null}
        </div>
      </div>
    </div>
  );
}
