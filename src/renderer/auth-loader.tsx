export function AuthLoader({
  label,
  deviceCode,
  loginUrl,
  onCancel,
  onOpenUrl,
}: {
  readonly label: string;
  readonly deviceCode?: string | null;
  readonly loginUrl?: string | null;
  readonly onCancel?: () => void;
  readonly onOpenUrl?: (url: string) => void;
}) {
  const actions = Boolean(onCancel || (loginUrl && onOpenUrl));
  return (
    <div className="shell shell--loading">
      <div className="auth-loader" data-testid="auth-loader">
        <div className="auth-loader__spinner" aria-hidden="true" />
        <p className="auth-loader__label">{label}</p>
        {deviceCode ? (
          <div className="sign-in__code" data-testid="sign-in-device-code">
            {deviceCode}
          </div>
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
