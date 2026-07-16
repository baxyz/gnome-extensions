import type Gio from "gi://Gio";
import { getBrowserEntries } from "../src/browser";
import { getDefaultBrowser } from "../src/default-browser";

const defaultBrowser = getDefaultBrowser();
if (defaultBrowser) {
  console.log(`Default browser: ${defaultBrowser.name} (${defaultBrowser.command.join(" ")})`);
} else {
  console.log("Default browser: (none detected)");
}

const entries = await getBrowserEntries();

if (entries.length === 0) {
  console.log("\n(no browsers found)");
  process.exit(0);
}

function meta(icon?: string, fgColor?: string, bgColor?: string): string {
  const parts: string[] = [];
  if (icon) parts.push(`icon: ${icon}`);
  if (fgColor) parts.push(`fg: ${fgColor}`);
  if (bgColor) parts.push(`bg: ${bgColor}`);
  return parts.length > 0 ? `  (${parts.join(", ")})` : "";
}

// item.icon is a plain icon-theme name (string, Firefox avatars) for family
// entries, or a real Gio.Icon (Browsers row / .desktop-fetched) for others —
// Gio.Icon.to_string() serializes any icon subtype (themed name, file path,
// bytes) generically, so this reports presence either way instead of only
// ever showing something for the string case.
function iconDescriptor(icon: string | Gio.Icon | undefined): string | undefined {
  if (icon === undefined) return undefined;
  if (typeof icon === "string") return icon;
  const withToString = icon as unknown as { to_string?: () => string | null };
  return withToString.to_string?.() ?? "(icon, no string form)";
}

for (const entry of entries) {
  console.log(`\n[${entry.label}]${entry.icon ? " (has browser icon)" : ""}`);
  for (const item of entry.items) {
    const def = item.isDefault ? " *" : "";
    const itemIcon = iconDescriptor(item.icon);
    const itemFg = item.color?.mode === "badge" ? item.color.fgColor : undefined;
    console.log(`  - ${item.label}${def}${meta(itemIcon, itemFg, item.color?.bgColor)}`);
    console.log(`    ${item.command.join(" ")}`);
    for (const space of item.spaces ?? []) {
      const spaceDef = space.isDefault ? " *" : "";
      console.log(
        `    · ${space.name}${spaceDef}${meta(space.icon, space.fgColor, space.bgColor)}`,
      );
      console.log(`      ${space.command.join(" ")}`);
    }
  }
}
