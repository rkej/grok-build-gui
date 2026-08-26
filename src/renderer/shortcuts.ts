/** Desktop shortcuts. App menu also binds New Thread and Open Folder. */
export const SHORTCUTS = [
  { keys: "Mod+N", action: "New thread" },
  { keys: "Mod+O", action: "Open folder" },
  { keys: "Mod+,", action: "Settings" },
  { keys: "Mod+B", action: "Toggle sidebar" },
  { keys: "Mod+D", action: "Toggle review panel" },
  { keys: "Mod+J", action: "Toggle terminal" },
  { keys: "Mod+F", action: "Find in thread" },
  { keys: "Mod+Shift+R", action: "Rename current thread" },
  { keys: "Mod+[", action: "Previous thread" },
  { keys: "Mod+]", action: "Next thread" },
] as const;
