import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { CloseIcon, MaximizeIcon, MinimizeIcon, RefreshIcon } from "./icons";

const MIN_TERMINAL_HEIGHT = 220;
const DEFAULT_TERMINAL_HEIGHT = 340;

export function TerminalPanel({
  cwd,
  height,
  isTakeover,
  onHeightChange,
  onToggleTakeover,
  onClose,
}: {
  readonly cwd: string;
  readonly height: number;
  readonly isTakeover: boolean;
  readonly onHeightChange: (height: number) => void;
  readonly onToggleTakeover: () => void;
  readonly onClose?: () => void;
}) {
  const panelRef = useRef<HTMLElement | null>(null);
  const screenRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastSizeRef = useRef({ cols: 80, rows: 24 });
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const [exited, setExited] = useState<number | null>(null);
  const [generation, setGeneration] = useState(0);

  const fitAndResize = useCallback(() => {
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    if (!terminal || !fitAddon || !screenRef.current) return;
    if (screenRef.current.clientWidth <= 0 || screenRef.current.clientHeight <= 0) return;
    fitAddon.fit();
    const next = { cols: terminal.cols, rows: terminal.rows };
    if (next.cols === lastSizeRef.current.cols && next.rows === lastSizeRef.current.rows) return;
    lastSizeRef.current = next;
    void window.grokApp.terminalResize(next.cols, next.rows);
  }, []);

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
    fitAddonRef.current = fit;

    const resizeObserver = new ResizeObserver(() => window.requestAnimationFrame(fitAndResize));
    resizeObserver.observe(screen);

    const dataDisposable = terminal.onData((data) => {
      void window.grokApp.terminalWrite(data);
    });
    const offData = window.grokApp.onTerminalData((chunk) => terminal.write(chunk));
    const offExit = window.grokApp.onTerminalExit((code) => {
      setExited(code);
      terminal.write(`\r\n\x1b[90m[process exited ${code ?? "unknown"}]\x1b[0m\r\n`);
    });

    terminal.focus();
    void window.grokApp.terminalStart(cwd, lastSizeRef.current).then(() => {
      window.requestAnimationFrame(fitAndResize);
    });

    return () => {
      resizeObserver.disconnect();
      dataDisposable.dispose();
      offData();
      offExit();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      void window.grokApp.terminalStop();
    };
  }, [cwd, fitAndResize, generation]);

  useEffect(() => {
    window.requestAnimationFrame(fitAndResize);
  }, [fitAndResize, height, isTakeover]);

  const restart = () => {
    terminalRef.current?.reset();
    setExited(null);
    setGeneration((value) => value + 1);
  };

  const startResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    resizeCleanupRef.current?.();
    const startY = event.clientY;
    const startHeight = panelRef.current?.offsetHeight ?? height ?? DEFAULT_TERMINAL_HEIGHT;
    const maxHeight = Math.max(MIN_TERMINAL_HEIGHT, window.innerHeight - 140);
    const handleMove = (moveEvent: MouseEvent) => {
      onHeightChange(Math.min(maxHeight, Math.max(MIN_TERMINAL_HEIGHT, startHeight + startY - moveEvent.clientY)));
    };
    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      resizeCleanupRef.current = null;
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    resizeCleanupRef.current = handleUp;
  };

  useEffect(() => () => { resizeCleanupRef.current?.(); }, []);

  return (
    <section
      ref={panelRef}
      className={`terminal-panel${isTakeover ? " terminal-panel--takeover" : ""}`}
      data-testid="integrated-terminal"
      aria-label="Integrated terminal"
      style={isTakeover ? undefined : { height: `${height || DEFAULT_TERMINAL_HEIGHT}px` }}
    >
      <div className="terminal-panel__resize-handle" onMouseDown={startResize} />
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
          <button className="icon-button terminal-panel__action" type="button" aria-label="Restart terminal" title="Restart terminal" onClick={restart}>
            <RefreshIcon />
          </button>
          <button
            className="icon-button terminal-panel__action"
            type="button"
            aria-label={isTakeover ? "Restore terminal" : "Maximize terminal"}
            title={isTakeover ? "Restore terminal" : "Maximize terminal"}
            onClick={onToggleTakeover}
          >
            {isTakeover ? <MinimizeIcon /> : <MaximizeIcon />}
          </button>
          {onClose ? (
            <button className="icon-button terminal-panel__action" type="button" aria-label="Hide terminal" title="Hide terminal" onClick={onClose}>
              <CloseIcon />
            </button>
          ) : null}
        </div>
      </div>
      <div ref={screenRef} className="terminal-panel__viewport" role="application" aria-label="Terminal input and output" />
    </section>
  );
}
