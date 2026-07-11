/**
 * How a profile item's own color should be presented, if it has one at all —
 * absent means no color data (Falkon, plain Firefox profiles).
 */
export type ColorPresentation =
  | { mode: "badge"; fgColor?: string; bgColor?: string } // rendered on the icon itself (Firefox Profile Groups)
  | { mode: "dot"; bgColor: string }; // rendered as a separate dot after the label (Chromium)

/**
 * Space shown as an icon button nested under a profile item (Zen workspace or
 * Firefox Profile Groups member). Unlike ResolvedBrowserItem, icon is
 * required: the resolvers in src/icons/ always resolve a space's icon
 * to a real name or the neutral dot fallback, never leaving it unset.
 */
export type BrowserSpace = {
  icon: string;
  /** CSS foreground color string */
  fgColor?: string;
  /** CSS background color string */
  bgColor?: string;
  name: string;
  command: string[];
  isDefault?: boolean;
};

export type ResolvedBrowserItem = {
  label: string;
  /** Fully built launch argv, ready to pass to Gio.Subprocess.new() */
  command: string[];
  /** A real, ready-to-render GNOME icon name — see src/icons/. */
  icon?: string;
  isDefault?: boolean;
  /** Sub-entries shown as icon buttons: Zen workspaces or Firefox profile groups */
  spaces?: BrowserSpace[];
  color?: ColorPresentation;
};

export type ResolvedBrowserEntry = {
  /** Browser name, used as the menu section label */
  label: string;
  items: ResolvedBrowserItem[];
  /** "simple" groups all profile-less browsers into a single icon-button row */
  group?: "simple";
};
