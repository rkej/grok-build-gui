import { useState, type FormEvent } from "react";
import type { AuthState } from "../shared/protocol";
import { GrokMark } from "./icons";

export function SignInView({
  auth,
  connected,
  grokBin,
  grokVersion,
  bootError,
  onSignIn,
  onSignInWithApiKey,
  onOpenUrl,
}: {
  readonly auth: AuthState;
  readonly connected: boolean;
  readonly grokBin: string | null;
  readonly grokVersion: string | null;
  readonly bootError: string | null;
  readonly onSignIn: () => void;
  readonly onSignInWithApiKey: (key: string) => void;
  readonly onOpenUrl: (url: string) => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const error = auth.error || (!connected ? bootError : null);
  const key = apiKey.trim();

  const onSubmitKey = (event: FormEvent) => {
    event.preventDefault();
    if (!key) return;
    onSignInWithApiKey(apiKey);
  };

  return (
    <div className="shell shell--signin">
      <div className="sign-in" data-testid="sign-in-view">
        <div className="sign-in__logo">
          <GrokMark />
        </div>
        <div className="sign-in__eyebrow">Grok Build</div>
        <h1>Sign in to Grok</h1>
        <p>Paste an API key from console.x.ai, or sign in with the Grok CLI in your browser.</p>
        {error ? <div className="sign-in__error">{error}</div> : null}
        <form className="sign-in__key" onSubmit={onSubmitKey}>
          <label className="sign-in__key-label" htmlFor="sign-in-api-key">
            API key
          </label>
          <input
            id="sign-in-api-key"
            data-testid="sign-in-api-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="xai-…"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
          />
          <button className="button button--primary" type="submit" disabled={!key}>
            Continue with API key
          </button>
        </form>
        <div className="sign-in__divider">or</div>
        <div className="sign-in__actions">
          <button
            className="button button--secondary"
            type="button"
            data-testid="sign-in-submit"
            onClick={onSignIn}
          >
            Sign in with browser
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
        <button className="sign-in__console" type="button" onClick={() => onOpenUrl("https://console.x.ai")}>
          Get a key at console.x.ai
        </button>
        <div className="sign-in__meta">
          {grokBin ? <span>{grokBin}</span> : <span>Grok CLI not found</span>}
          {grokVersion ? <span>{grokVersion}</span> : null}
        </div>
      </div>
    </div>
  );
}
