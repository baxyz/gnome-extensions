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

for (const entry of entries) {
  console.log(`\n[${entry.label}]`);
  for (const item of entry.items) {
    const def = item.isDefault ? " *" : "";
    console.log(`  - ${item.label}${def}`);
    console.log(`    ${item.command}`);
    for (const space of item.spaces ?? []) {
      const spaceDef = space.isDefault ? " *" : "";
      console.log(`    · ${space.name}${spaceDef}`);
      console.log(`      ${space.command}`);
    }
  }
}
