import { getBrowserEntries } from "../src/helper";

const entries = await getBrowserEntries();

if (entries.length === 0) {
  console.log("(no browsers found)");
  process.exit(0);
}

for (const entry of entries) {
  console.log(`\n[${entry.label}]`);
  for (const item of entry.items) {
    console.log(`  - ${item.label}`);
    console.log(`    ${item.command}`);
    for (const space of item.spaces ?? []) {
      console.log(`    · ${space.name}`);
      console.log(`      ${space.command}`);
    }
  }
}
