/** Official install guidance from x.ai/cli and Grok Build getting-started docs. */

export const GROK_CLI_DOCS_URL = "https://x.ai/cli";
export const GROK_INSTALL_SH_COMMAND = "curl -fsSL https://x.ai/cli/install.sh | bash";
export const GROK_INSTALL_PS1_COMMAND = "irm https://x.ai/cli/install.ps1 | iex";

export type GrokInstallGuidance = {
  osLabel: string;
  shell: string;
  command: string;
  verify: string;
  notes: string[];
};

export function grokInstallGuidance(platform: string): GrokInstallGuidance {
  if (platform === "win32") {
    return {
      osLabel: "Windows",
      shell: "PowerShell",
      command: GROK_INSTALL_PS1_COMMAND,
      verify: "grok --version",
      notes: [
        "This adds %USERPROFILE%\\.grok\\bin to your user PATH.",
        "Git Bash or MSYS2 can use the macOS/Linux command instead.",
        "WSL installs a Linux binary; this app needs the Windows grok.exe.",
      ],
    };
  }
  if (platform === "darwin") {
    return {
      osLabel: "macOS",
      shell: "Terminal",
      command: GROK_INSTALL_SH_COMMAND,
      verify: "grok --version",
      notes: ["After it finishes, return here and click Recheck."],
    };
  }
  return {
    osLabel: "Linux",
    shell: "Terminal",
    command: GROK_INSTALL_SH_COMMAND,
    verify: "grok --version",
    notes: ["After it finishes, return here and click Recheck."],
  };
}
