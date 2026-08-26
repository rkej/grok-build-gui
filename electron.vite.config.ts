import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

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
