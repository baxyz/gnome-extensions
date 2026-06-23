import type { ZenSpace } from "./zen-space.types";

export type ResolvedBrowserItem = {
  label: string;
  /** Fully built launch command, ready to pass to GLib.spawn_command_line_async */
  command: string;
  /** Zen Browser spaces within this profile, for future workspace mini-buttons UI */
  spaces?: ZenSpace[];
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
