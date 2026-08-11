import type * as Main from "resource:///org/gnome/shell/ui/main.js";
import type { PopupDummyMenu, PopupMenu } from "resource:///org/gnome/shell/ui/popupMenu.js";
import { PopupMenuItem } from "resource:///org/gnome/shell/ui/popupMenu.js";
import type { ResolvedBrowserEntry, ResolvedBrowserItem, ResolvedBrowserPkg } from "../taxonomy";
import type { DefaultBrowserInfo } from "../default-browser";
import { findDonutBrowser } from "../donut-browser";
import { isEmpty } from "@helpers4/array";
import { noop } from "@helpers4/function";
import { delay } from "@helpers4/promise";
import { buildCategorySeparator, buildErrorRow, buildLoadingRow } from "./shared";
import { buildDefaultBrowserItem, buildToolbar } from "./toolbar";
import { buildProfileMenuItem, buildSimpleBrowserRow } from "./browser-rows";

// Same batch size/delay as the Browsers row (buildSimpleBrowserRow) — pacing
// profile-item icon construction the same way, since a browser family with
// many profiles (or Zen workspaces per profile) is the same risk on a
// smaller scale: GNOME Shell's icon theme loader corrupting state under
// many concurrent icon loads.
const PROFILE_ITEM_BATCH_SIZE = 6;
const PROFILE_ITEM_BATCH_DELAY_MS = 30;

/** Pauses every `batchSize`-th call — shared across every entry's items, not reset per entry. */
function makePacer(batchSize: number, delayMs: number): () => Promise<void> {
  let count = 0;
  return async () => {
    count++;
    if (count % batchSize === 0) await delay(delayMs);
  };
}

/**
 * Builds the complete extension menu: toolbar (default browser, refresh, settings),
 * separators, and all browser entries with their profiles/spaces.
 */
export async function fillMenu({
  title,
  menu,
  entries,
  errors = [],
  notify,
  onSettings,
  onRefresh,
  defaultBrowser,
  showToolbar = true,
  showDefaultBrowserEdit = true,
  onSetDefaultBrowser = noop,
  showDonutBrowser = false,
  donutLaunching = false,
  onLaunchDonut = noop,
  isLive = () => true,
}: {
  title: string;
  menu: PopupMenu | PopupDummyMenu;
  /** null means the browser scan hasn't resolved yet — shows a loading row instead. */
  entries: ResolvedBrowserEntry[] | null;
  /** Short messages for whatever failed during the scan — shown as a banner. */
  errors?: string[];
  notify: typeof Main.notify;
  onSettings: () => void;
  onRefresh: () => void;
  defaultBrowser?: DefaultBrowserInfo | null;
  showToolbar?: boolean;
  showDefaultBrowserEdit?: boolean;
  onSetDefaultBrowser?: (pkg: ResolvedBrowserPkg) => void;
  showDonutBrowser?: boolean;
  /** Whether a Donut profile launch triggered by a previous click is still in flight. */
  donutLaunching?: boolean;
  onLaunchDonut?: (item: ResolvedBrowserItem & { pkg: ResolvedBrowserPkg }) => void;
  /**
   * Checked before the (staggered, so potentially slow) Browsers row is
   * added to the menu — false means a later fillMenu() call has already
   * cleared and rebuilt `menu`, so this one must stop touching it.
   */
  isLive?: () => boolean;
}): Promise<void> {
  if ("removeAll" in menu) {
    menu.removeAll();
  }

  if (!("addMenuItem" in menu)) {
    return;
  }

  const closeMenu = () => (menu as { close(): void }).close();

  // Both the picker and the Donut button act on the same "Browsers" row
  // items the quick-launch icons below are built from — one row per
  // installed browser identity, already carrying pkg.
  const browsers = entries?.find((e) => e.group === "simple")?.items ?? [];
  const donutBrowser = showDonutBrowser ? findDonutBrowser(browsers, defaultBrowser ?? null) : null;

  // Off, this hides the whole row — including Refresh and Settings, so
  // there's no in-menu way back into preferences (the GNOME Extensions app
  // still works). A deliberate tradeoff, not an oversight.
  if (showToolbar) {
    menu.addMenuItem(
      buildToolbar({
        showDonutButton: donutBrowser !== null,
        donutLaunching,
        onLaunchDonut: () => onLaunchDonut(donutBrowser!),
        onRefresh,
        onSettings,
      }),
    );
    if (!isEmpty(errors)) {
      menu.addMenuItem(buildErrorRow(errors));
    }
    // After the toolbar, not before: as a real PopupSubMenuMenuItem it reads
    // as its own section rather than a compact toolbar control, closer to a
    // preferences category than a quick-action row.
    if (defaultBrowser) {
      menu.addMenuItem(
        buildDefaultBrowserItem({
          title,
          defaultBrowser,
          showDefaultBrowserEdit,
          browsers,
          onSetDefaultBrowser,
          notify,
          closeMenu,
        }),
      );
    }
  }

  // No separator above either row below — nothing here to separate it from,
  // unlike the labeled separator before each real entry group further down.
  if (entries === null) {
    menu.addMenuItem(buildLoadingRow());
    return;
  }

  if (isEmpty(entries)) {
    // Every toggle disabled in Settings is a far more likely cause of this
    // than a genuine absence of any installed browser — lead with that.
    menu.addMenuItem(
      new PopupMenuItem("Nothing to show — check Settings, or install a browser", {
        reactive: false,
      }),
    );
    return;
  }

  // Build browser entries. The category separator also acts as a section
  // header, so a lone "Browsers" row (every profiled family disabled or
  // filtered out) skips it — nothing left to separate it from. A lone
  // profiled entry (only Firefox enabled, say) still gets its header: its
  // label names the family the profile rows below actually belong to.
  const soloSimpleRow = entries.length === 1 && entries[0].group === "simple";
  const paceProfileItem = makePacer(PROFILE_ITEM_BATCH_SIZE, PROFILE_ITEM_BATCH_DELAY_MS);
  for (const entry of entries) {
    // Each entry (and each profile item within one) renders in its own
    // try/catch: unexpected data reaching a widget constructor shouldn't
    // cost every other browser its place in the menu.
    try {
      if (!soloSimpleRow) {
        menu.addMenuItem(buildCategorySeparator(entry.label, entry.icon));
      }

      if (entry.group === "simple") {
        // Simple browsers (no profiles) - show as icon buttons in a row,
        // built in staggered batches (see buildSimpleBrowserRow) — the
        // await can leave this row appearing after the entries below it,
        // but Browsers is always last in getBrowserEntries()'s own output.
        const row = await buildSimpleBrowserRow(
          { title, items: entry.items, notify, closeMenu },
          isLive,
        );
        if (!isLive()) return;
        if (row) menu.addMenuItem(row);
      } else {
        // Firefox/Chromium/Falkon browsers with profiles
        for (const item of entry.items) {
          try {
            menu.addMenuItem(buildProfileMenuItem({ item, title, notify, closeMenu }));
          } catch (e) {
            logError(e as object, `[browser-hub] failed to render ${entry.label}'s ${item.label}`);
          }
          await paceProfileItem();
          if (!isLive()) return;
        }
      }
    } catch (e) {
      logError(e as object, `[browser-hub] failed to render ${entry.label}`);
    }
  }
}
