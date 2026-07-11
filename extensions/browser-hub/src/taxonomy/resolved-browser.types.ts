/** Icon/color metadata shared by spaces and top-level profile items */
type Colored = {
  /** A real, ready-to-render GNOME icon name — see src/helper/icons/. */
  icon?: string;
  /** CSS foreground color string */
  fgColor?: string;
  /** CSS background color string */
  bgColor?: string;
};

/**
 * Minimal shape shared by Zen workspaces and Firefox profile groups.
 * Unlike ResolvedBrowserItem, icon is required: the resolvers in src/helper/icons/
 * always resolve a space's icon to a real name or the neutral dot fallback,
 * never leaving it unset.
 */
export type BrowserSpace = Omit<Colored, "icon"> & {
  icon: string;
  name: string;
  command: string[];
  isDefault?: boolean;
};

export type ResolvedBrowserItem = Colored & {
  label: string;
  /** Fully built launch argv, ready to pass to Gio.Subprocess.new() */
  command: string[];
  /** Sub-entries shown as icon buttons: Zen workspaces or Firefox profile groups */
  spaces?: BrowserSpace[];
  isDefault?: boolean;
  /**
   * True only when bgColor is a real, resolver-computed color meant to be
   * shown as-is (currently just Chromium's account color). Firefox profile
   * theme colors are also carried on bgColor (for future icon+color
   * rendering) but must NOT set this — they aren't ready to render alone.
   */
  showColorDot?: boolean;
};

export type ResolvedBrowserEntry = {
  /** Browser name, used as the menu section label */
  label: string;
  items: ResolvedBrowserItem[];
  /** "simple" groups all profile-less browsers into a single icon-button row */
  group?: "simple";
};
