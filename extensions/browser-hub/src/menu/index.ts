import type * as Main from "resource:///org/gnome/shell/ui/main.js";
import type { PopupDummyMenu, PopupMenu } from "resource:///org/gnome/shell/ui/popupMenu.js";
import { PopupMenuItem } from "resource:///org/gnome/shell/ui/popupMenu.js";
import type { ResolvedBrowserEntry, ResolvedBrowserItem, ResolvedBrowserPkg } from "../taxonomy";
import type { DefaultBrowserInfo } from "../default-browser";
import { findDonutBrowser, filterDonutEligible } from "../donut-browser";
import { isEmpty } from "@helpers4/array";
import { noop } from "@helpers4/function";
import { pause } from "../internal";
import {
  buildCategorySeparator,
  buildErrorRow,
  buildLoadingRow,
  buildPickerRow,
  buildScrollablePickerList,
  buildSubPageHeader,
  buildTruncatedRow,
} from "./shared";
import {
  buildDefaultBrowserItem,
  buildDonutItem,
  buildToolbar,
  filterDefaultBrowserPickable,
} from "./toolbar";
import { buildProfileMenuItem, buildSimpleBrowserRow } from "./browser-rows";

export type MenuPage = "main" | "default-browser" | "donut";

// Building many icons at once can break GNOME Shell's icon loader, so
// profile rows are built in small batches.
const PROFILE_ITEM_BATCH_SIZE = 6;
const PROFILE_ITEM_BATCH_DELAY_MS = 30;

/** Waits every `batchSize`-th call. */
function makePacer(batchSize: number, delayMs: number): () => Promise<void> {
  let count = 0;
  return async () => {
    count++;
    if (count % batchSize === 0) await pause(delayMs);
  };
}

// Upper bound on icons per menu build, whatever the number of profiles.
const MAX_ICONS_PER_PASS = 50;

function truncateEntriesToIconBudget(
  entries: ResolvedBrowserEntry[],
  maxIcons: number,
): { visible: ResolvedBrowserEntry[]; hiddenCount: number } {
  let budget = maxIcons;
  let hiddenCount = 0;
  const visible: ResolvedBrowserEntry[] = [];
  for (const entry of entries) {
    const visibleItems = entry.items.slice(0, Math.max(budget, 0));
    hiddenCount += entry.items.length - visibleItems.length;
    budget -= visibleItems.length;
    if (visibleItems.length > 0) {
      visible.push({ ...entry, items: visibleItems });
    }
  }
  return { visible, hiddenCount };
}

/** Builds the whole menu: toolbar, then each browser family and its profiles. */
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
  page = "main",
  onOpenDefaultBrowserPage = noop,
  onOpenDonutPage = noop,
  onBack = noop,
}: {
  title: string;
  menu: PopupMenu | PopupDummyMenu;
  /** null while the scan is still running. */
  entries: ResolvedBrowserEntry[] | null;
  /** What failed during the scan, shown as a banner. */
  errors?: string[];
  notify: typeof Main.notify;
  onSettings: () => void;
  onRefresh: () => void;
  defaultBrowser?: DefaultBrowserInfo | null;
  showToolbar?: boolean;
  showDefaultBrowserEdit?: boolean;
  onSetDefaultBrowser?: (pkg: ResolvedBrowserPkg) => void;
  showDonutBrowser?: boolean;
  /** A Donut launch is still in progress. */
  donutLaunching?: boolean;
  onLaunchDonut?: (item: ResolvedBrowserItem & { pkg: ResolvedBrowserPkg }) => void;
  /** False once a newer fillMenu() call has rebuilt the menu. */
  isLive?: () => boolean;
  page?: MenuPage;
  onOpenDefaultBrowserPage?: () => void;
  onOpenDonutPage?: () => void;
  onBack?: () => void;
}): Promise<void> {
  if ("removeAll" in menu) {
    menu.removeAll();
  }

  if (!("addMenuItem" in menu)) {
    return;
  }

  const closeMenu = () => (menu as { close(): void }).close();

  const browsers = entries?.find((e) => e.group === "simple")?.items ?? [];
  const donutBrowser = showDonutBrowser ? findDonutBrowser(browsers, defaultBrowser ?? null) : null;

  // See menu/shared.ts for why sub-pages replace the whole menu.
  if (page === "default-browser") {
    menu.addMenuItem(buildSubPageHeader("Change default browser", onBack));
    const items = filterDefaultBrowserPickable(browsers).slice(0, MAX_ICONS_PER_PASS);
    const rows = items.map((item) =>
      buildPickerRow(item, (picked) => {
        onBack();
        onSetDefaultBrowser(picked.pkg);
      }),
    );
    menu.addMenuItem(buildScrollablePickerList(rows));
    return;
  }
  if (page === "donut") {
    menu.addMenuItem(buildSubPageHeader("Choose a browser for the burner session", onBack));
    const items = filterDonutEligible(browsers).slice(0, MAX_ICONS_PER_PASS);
    const rows = items.map((item) =>
      buildPickerRow(item, (picked) => {
        onBack();
        onLaunchDonut(picked);
      }),
    );
    menu.addMenuItem(buildScrollablePickerList(rows));
    return;
  }

  // Hiding the toolbar also hides Settings; the Extensions app still opens it.
  if (showToolbar) {
    menu.addMenuItem(buildToolbar({ onRefresh, onSettings }));
    if (!isEmpty(errors)) {
      menu.addMenuItem(buildErrorRow(errors));
    }
    if (defaultBrowser && showDefaultBrowserEdit) {
      menu.addMenuItem(
        buildDefaultBrowserItem({
          title,
          defaultBrowser,
          onOpenDefaultBrowserPage,
          notify,
          closeMenu,
        }),
      );
    }
    const donutItem = buildDonutItem({
      donutBrowser,
      donutLaunching,
      onLaunchDonut,
      onOpenDonutPage,
      closeMenu,
    });
    if (donutItem) menu.addMenuItem(donutItem);
  }

  if (entries === null) {
    menu.addMenuItem(buildLoadingRow());
    return;
  }

  if (isEmpty(entries)) {
    menu.addMenuItem(
      new PopupMenuItem("Nothing to show — check Settings, or install a browser", {
        reactive: false,
      }),
    );
    return;
  }

  const { visible: visibleEntries, hiddenCount } = truncateEntriesToIconBudget(
    entries,
    MAX_ICONS_PER_PASS,
  );

  // A lone Browsers row needs no section header.
  const soloSimpleRow = visibleEntries.length === 1 && visibleEntries[0].group === "simple";
  const paceProfileItem = makePacer(PROFILE_ITEM_BATCH_SIZE, PROFILE_ITEM_BATCH_DELAY_MS);
  for (const entry of visibleEntries) {
    // Each entry and item is rendered on its own, so bad data only hides that one.
    try {
      if (!soloSimpleRow) {
        menu.addMenuItem(buildCategorySeparator(entry.label, entry.icon));
      }

      if (entry.group === "simple") {
        // Browsers without profiles, as a row of icons.
        const row = await buildSimpleBrowserRow(
          { title, items: entry.items, notify, closeMenu },
          isLive,
        );
        if (!isLive()) return;
        if (row) menu.addMenuItem(row);
      } else {
        // Browsers with profiles.
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

  if (hiddenCount > 0) {
    menu.addMenuItem(buildTruncatedRow(hiddenCount));
  }
}
