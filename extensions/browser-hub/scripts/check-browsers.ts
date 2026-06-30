import { getBrowserEntries } from "../src/helper";
import { getDefaultBrowser } from "../src/helper/default-browser.helper";

const defaultBrowser = getDefaultBrowser();
if (defaultBrowser) {
  console.log(`Default browser: ${defaultBrowser.name} (${defaultBrowser.command})`);
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

for (const entry of entries) {
  console.log(`\n[${entry.label}]`);
  for (const item of entry.items) {
    const def = item.isDefault ? " *" : "";
    console.log(`  - ${item.label}${def}${meta(item.icon, item.fgColor, item.bgColor)}`);
    console.log(`    ${item.command}`);
    for (const space of item.spaces ?? []) {
      const spaceDef = space.isDefault ? " *" : "";
      console.log(
        `    · ${space.name}${spaceDef}${meta(space.icon, space.fgColor, space.bgColor)}`,
      );
      console.log(`      ${space.command}`);
    }
  }
}
