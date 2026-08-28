export function AuthLoader({
  label,
  deviceCode,
  loginUrl,
  onCancel,
  onOpenUrl,
  onCopyCode,
}: {
  readonly label: string;
  readonly deviceCode?: string | null;
  readonly loginUrl?: string | null;
  readonly onCancel?: () => void;
  readonly onOpenUrl?: (url: string) => void;
  readonly onCopyCode?: (code: string) => void;
}) {
  const actions = Boolean(onCancel || (loginUrl && onOpenUrl));
  return (
    <div className="shell shell--loading">
      <div className="auth-loader" data-testid="auth-loader">
        <div className="auth-loader__spinner" aria-hidden="true" />
        <p className="auth-loader__label">{label}</p>
        {deviceCode ? (
          <button
            className="sign-in__code"
            type="button"
            data-testid="sign-in-device-code"
            title="Copy code"
            onClick={() => onCopyCode?.(deviceCode)}
          >
            {deviceCode}
          </button>
        ) : null}
        {actions ? (
          <div className="auth-loader__actions">
            {onCancel ? (
              <button className="button button--ghost" type="button" onClick={onCancel}>
                Cancel
              </button>
            ) : null}
            {loginUrl && onOpenUrl ? (
              <button className="button button--secondary" type="button" onClick={() => onOpenUrl(loginUrl)}>
                Open browser
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
