import type Gio from "gi://Gio";
import type { ResolvedBrowserPkg } from "./browser-package.types";
import type { LaunchTarget } from "./launch-target.types";

/** How a profile's color is shown. Absent when it has none. */
// fgColor tints the icon; bgColor is the pill behind it.
export type ColorPresentation =
  | { mode: "badge"; fgColor?: string; bgColor?: string } // Firefox Profile Groups
  | { mode: "dot"; bgColor: string }; // rendered as a separate dot after the label (Chromium)

/** A space button under a profile (Zen workspace or Profile Groups member). Always has an icon. */
export type BrowserSpace = {
  icon: string;
  /** CSS color */
  fgColor?: string;
  /** CSS color */
  bgColor?: string;
  name: string;
  launch: LaunchTarget;
  isDefault?: boolean;
};

export type ResolvedBrowserItem = {
  label: string;
  launch: LaunchTarget;
  /**
   * In a family: the profile's avatar icon, if any. In the "simple" row:
   * the browser's own icon.
   */
  icon?: string | Gio.Icon;
  isDefault?: boolean;
  /** Zen workspaces or Firefox Profile Groups members */
  spaces?: BrowserSpace[];
  color?: ColorPresentation;
  /** Only on "simple" row items, for the default-browser picker. */
  pkg?: ResolvedBrowserPkg;
};

export type ResolvedBrowserEntry = {
  /** Section label */
  label: string;
  items: ResolvedBrowserItem[];
  /** "simple" is the Browsers row */
  group?: "simple";
  /** The browser's icon, shown next to the section label. Absent for the Browsers row. */
  icon?: string | Gio.Icon;
};
