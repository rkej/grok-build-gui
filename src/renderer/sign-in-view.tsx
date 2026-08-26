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
  const signingIn = Boolean(auth.signingIn);
  const error = auth.error || (!connected && !signingIn ? bootError : null);
  const status = signingIn
    ? auth.deviceCode
      ? "Enter this code in your browser to finish signing in."
      : "Complete sign-in in your browser. This window will unlock when the Grok CLI finishes."
    : "This desktop shell uses your Grok CLI session. Sign in to continue.";

  return (
    <div className="shell shell--signin">
      <div className="sign-in" data-testid="sign-in-view">
        <div className="sign-in__logo">
          <GrokMark />
        </div>
        <div className="sign-in__eyebrow">Grok Build</div>
        <h1>{signingIn ? "Waiting for Grok CLI" : "Sign in to Grok"}</h1>
        <p>{status}</p>
        {auth.deviceCode ? (
          <div className="sign-in__code" data-testid="sign-in-device-code">
            {auth.deviceCode}
          </div>
        ) : null}
        {error ? <div className="sign-in__error">{error}</div> : null}
        <div className="sign-in__actions">
          <button
            className="button button--primary"
            type="button"
            data-testid="sign-in-submit"
            disabled={signingIn}
            onClick={onSignIn}
          >
            {signingIn ? "Signing in…" : error ? "Try again" : "Sign in"}
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
