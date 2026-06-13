export type ResolvedBrowserItem = {
  label: string;
  /** Fully built launch command, ready to pass to GLib.spawn_command_line_async */
  command: string;
};

export type ResolvedBrowserEntry = {
  /** Browser name, used as the menu section label */
  label: string;
  items: ResolvedBrowserItem[];
};
