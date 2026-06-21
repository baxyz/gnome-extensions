import { getBrowserEntries } from "../src/helper";

const entries = await getBrowserEntries();

if (entries.length === 0) {
  console.log("(no browsers found)");
  process.exit(0);
}

for (const entry of entries) {
  console.log(`\n[${entry.label}]`);
  for (const item of entry.items) {
    const spaces = item.spaces?.map((s) => s.name).join(", ");
    console.log(`  - ${item.label}${spaces ? `: ${spaces}` : ""}`);
  }
}
