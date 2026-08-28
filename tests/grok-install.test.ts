import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GROK_INSTALL_PS1_COMMAND,
  GROK_INSTALL_SH_COMMAND,
  grokInstallGuidance,
} from "../src/shared/grok-install.js";

test("grokInstallGuidance matches public docs per OS", () => {
  const mac = grokInstallGuidance("darwin");
  assert.equal(mac.osLabel, "macOS");
  assert.equal(mac.shell, "Terminal");
  assert.equal(mac.command, GROK_INSTALL_SH_COMMAND);

  const linux = grokInstallGuidance("linux");
  assert.equal(linux.osLabel, "Linux");
  assert.equal(linux.command, GROK_INSTALL_SH_COMMAND);

  const win = grokInstallGuidance("win32");
  assert.equal(win.osLabel, "Windows");
  assert.equal(win.shell, "PowerShell");
  assert.equal(win.command, GROK_INSTALL_PS1_COMMAND);
  assert.ok(win.notes.some((note) => /WSL/i.test(note)));
});
