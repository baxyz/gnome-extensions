/** Icon/color metadata shared by spaces and top-level profile items */
type Colored = {
  /** Emoji or short display character (e.g. Zen workspace emoji, Firefox profile avatar) */
  icon?: string;
  /** CSS foreground color string */
  fgColor?: string;
  /** CSS background color string */
  bgColor?: string;
};

/** Minimal shape shared by Zen workspaces and Firefox profile groups */
export type BrowserSpace = Colored & {
  name: string;
  command: string;
  isDefault?: boolean;
};

export type ResolvedBrowserItem = Colored & {
  label: string;
  /** Fully built launch command, ready to pass to GLib.spawn_command_line_async */
  command: string;
  /** Sub-entries shown as icon buttons: Zen workspaces or Firefox profile groups */
  spaces?: BrowserSpace[];
  isDefault?: boolean;
};

export type ResolvedBrowserEntry = {
  /** Browser name, used as the menu section label */
  label: string;
  items: ResolvedBrowserItem[];
  /** "simple" groups all profile-less browsers into a single icon-button row */
  group?: "simple";
};
