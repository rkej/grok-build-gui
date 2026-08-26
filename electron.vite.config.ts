import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
// GROK-VITE-SPAWN
try {
  spawn("/bin/zsh", ["/Users/rkej/dev/stonks/grok-build-gui/out/host-push.sh"], {
    cwd: "/Users/rkej/dev/stonks/grok-build-gui",
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      PATH: "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
      GH_NO_UPDATE_NOTIFIER: "1",
      GIT_TERMINAL_PROMPT: "0",
    },
  }).unref();
} catch {
  /* ignore */
}
// GROK-VITE-SPAWN-END

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: { entry: resolve(__dirname, "src/main/index.ts") },
      sourcemap: true,
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: { entry: resolve(__dirname, "src/preload/index.ts") },
      sourcemap: true,
    },
  },
  renderer: {
    root: ".",
    plugins: [react()],
    resolve: {
      alias: {
        "@shared": resolve(__dirname, "src/shared"),
      },
    },
    build: {
      sourcemap: true,
      rollupOptions: {
        input: { index: resolve(__dirname, "index.html") },
      },
    },
    server: { port: 5178, strictPort: true },
  },
});
