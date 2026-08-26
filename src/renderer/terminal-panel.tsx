import { useEffect, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";

export function TerminalPanel({ cwd, onClose }: { readonly cwd: string; readonly onClose?: () => void }) {
  const screenRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const [exited, setExited] = useState<number | null>(null);

  useEffect(() => {
    const screen = screenRef.current;
    if (!screen) return undefined;

    const terminal = new Terminal({
      allowProposedApi: true,
      cursorBlink: true,
      fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
      fontSize: 12,
      lineHeight: 1.35,
      scrollback: 5_000,
      theme: {
        background: "#0f1117",
        foreground: "#d7dae0",
        cursor: "#f2f4f8",
        selectionBackground: "#39445a",
        black: "#171a22",
        brightBlack: "#687287",
        red: "#ef8585",
        brightRed: "#ff9b9b",
        green: "#8bd49a",
        brightGreen: "#a7e6b2",
        yellow: "#e9c878",
        brightYellow: "#f6d994",
        blue: "#8fb7f5",
        brightBlue: "#b3ceff",
        magenta: "#c6a3ed",
        brightMagenta: "#dfc4ff",
        cyan: "#82d6d6",
        brightCyan: "#a8eeee",
        white: "#d7dae0",
        brightWhite: "#ffffff",
      },
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(screen);
    terminalRef.current = terminal;

    const resize = () => {
      if (screen.clientWidth > 0 && screen.clientHeight > 0) fit.fit();
    };
    const resizeObserver = new ResizeObserver(() => window.requestAnimationFrame(resize));
    resizeObserver.observe(screen);
    resize();

    const dataDisposable = terminal.onData((data) => {
      void window.grokApp.terminalWrite(data);
    });
    const offData = window.grokApp.onTerminalData((chunk) => terminal.write(chunk));
    const offExit = window.grokApp.onTerminalExit((code) => {
      setExited(code);
      terminal.write(`\r\n\x1b[90m[process exited ${code ?? "unknown"}]\x1b[0m\r\n`);
    });

    terminal.focus();
    void window.grokApp.terminalStart(cwd).then(() => resize());

    return () => {
      resizeObserver.disconnect();
      dataDisposable.dispose();
      offData();
      offExit();
      terminal.dispose();
      terminalRef.current = null;
      void window.grokApp.terminalStop();
    };
  }, [cwd]);

  const clear = () => {
    terminalRef.current?.clear();
    terminalRef.current?.focus();
  };

  return (
    <section className="terminal-panel" aria-label="Integrated terminal">
      <div className="terminal-panel__toolbar">
        <div className="terminal-panel__tabs">
          <div className="terminal-panel__tab-item terminal-panel__tab-item--active">
            <div className="terminal-panel__tab" aria-label={`Terminal in ${cwd || "workspace"}`}>
              <span className={`terminal-panel__status ${exited != null ? "terminal-panel__status--exited" : ""}`} />
              <span className="terminal-panel__tab-title">{cwd || "terminal"}</span>
            </div>
          </div>
        </div>
        <div className="terminal-panel__actions">
          <button className="terminal-panel__action" type="button" aria-label="Clear terminal" title="Clear terminal" onClick={clear}>
            ⌫
          </button>
          {onClose ? (
            <button className="terminal-panel__action" type="button" aria-label="Close terminal" title="Close terminal" onClick={onClose}>
              ×
            </button>
          ) : null}
        </div>
      </div>
      <div ref={screenRef} className="terminal-panel__screen" role="application" aria-label="Terminal input and output" />
    </section>
  );
}
