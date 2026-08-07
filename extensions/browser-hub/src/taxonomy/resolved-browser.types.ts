import type Gio from "gi://Gio";
import type { ResolvedBrowserPkg } from "./browser-package.types";

/**
 * How a profile item's own color should be presented, if it has one at all —
 * absent means no color data (Falkon, plain Firefox profiles).
 */
// fgColor tints the icon glyph itself; bgColor (if known) adds a colored pill
// behind it. bgColor alone (no fgColor) would tint an icon-shaped hole in the
// pill using the pill's own color — illegible — so menu.ts always renders
// fgColor as the tint and bgColor only as the pill.
export type ColorPresentation =
  | { mode: "badge"; fgColor?: string; bgColor?: string } // Firefox Profile Groups
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
   * In a family entry (Firefox/Chromium/Falkon): a GNOME/Adwaita icon name
   * for a per-profile identity (Firefox Profile Groups avatars — see
   * src/icons/), or undefined — the browser's own icon is never used as a
   * per-item fallback here, it's shown once on the entry instead (see
   * ResolvedBrowserEntry.icon below). In the "simple" row, each item IS a
   * distinct browser, so it carries that browser's own real icon directly
   * (a Gio.Icon fetched from its .desktop file).
   */
  icon?: string | Gio.Icon;
  isDefault?: boolean;
  /** Sub-entries shown as icon buttons: Zen workspaces or Firefox profile groups */
  spaces?: BrowserSpace[];
  color?: ColorPresentation;
  /**
   * Only set on "simple" row items (see resolveBrowsersRow) — lets the
   * default-browser picker call setDefaultBrowser(pkg) on the exact browser
   * identity a row represents. Absent on family entries' profile items,
   * where "default browser" isn't a meaningful per-profile concept.
   */
  pkg?: ResolvedBrowserPkg;
};

export type ResolvedBrowserEntry = {
  /** Browser name, used as the menu section label */
  label: string;
  items: ResolvedBrowserItem[];
  /** "simple" groups all profile-less browsers into a single icon-button row */
  group?: "simple";
  /**
   * The browser's own real icon, fetched from its installed .desktop file
   * (see src/internal/desktop-icon.ts) — shown once next to the section
   * label instead of being repeated on every profile item. Absent for the
   * "simple" row, which aggregates many different browsers.
   */
  icon?: Gio.Icon;
};
