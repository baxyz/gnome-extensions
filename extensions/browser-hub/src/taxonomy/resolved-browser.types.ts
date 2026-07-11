import type Gio from "gi://Gio";

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
  /**
   * Either a GNOME/Adwaita icon name (Firefox Profile Groups avatars — see
   * src/icons/) or the browser's own real icon fetched from its installed
   * .desktop file (see src/internal/desktop-icon.ts). St.Icon takes the
   * former as `icon_name`, the latter as `gicon`.
   */
  icon?: string | Gio.Icon;
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
