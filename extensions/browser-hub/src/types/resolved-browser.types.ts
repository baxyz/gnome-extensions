/** Minimal shape shared by Zen workspaces and Firefox profile groups */
export type BrowserSpace = {
  name: string;
  command: string;
};

export type ResolvedBrowserItem = {
  label: string;
  /** Fully built launch command, ready to pass to GLib.spawn_command_line_async */
  command: string;
  /** Sub-entries shown as icon buttons: Zen workspaces or Firefox profile groups */
  spaces?: BrowserSpace[];
  /** Desktop icon name for icon-button rendering (simple browsers) */
  icon?: string;
};

export type ResolvedBrowserEntry = {
  /** Browser name, used as the menu section label */
  label: string;
  items: ResolvedBrowserItem[];
  /** "simple" groups all profile-less browsers into a single icon-button row */
  group?: "simple";
};
