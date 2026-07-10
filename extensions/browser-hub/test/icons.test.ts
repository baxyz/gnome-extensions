import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { FIREFOX_AVATAR_ICONS, ZEN_WORKSPACE_ICONS } from "../src/icons/icon-catalog";
import {
  BROWSER_FALLBACK_ICON,
  SPACE_FALLBACK_ICON,
  resolveFirefoxIcon,
  resolveZenIcon,
} from "../src/icons";

// Firefox's 28 standard avatars, from browser/components/profiles/SelectableProfile.sys.mjs
// (STANDARD_AVATARS) as of mozilla-firefox/firefox@main, checked 2026-07-09.
const FIREFOX_STANDARD_AVATARS = [
  "barbell",
  "bike",
  "book",
  "briefcase",
  "canvas",
  "craft",
  "default-favicon",
  "diamond",
  "flower",
  "folder",
  "hammer",
  "heart",
  "heart-rate",
  "history",
  "leaf",
  "lightbulb",
  "makeup",
  "message",
  "musical-note",
  "palette",
  "paw-print",
  "plane",
  "present",
  "shopping",
  "soccer",
  "sparkle-single",
  "star",
  "video-game-controller",
];

// Zen's 87 selectable workspace icons, from the .svg filenames under
// src/browser/themes/shared/zen-icons/common/selectable/ in zen-browser/desktop@dev,
// checked 2026-07-09.
const ZEN_SELECTABLE_ICONS = [
  "airplane",
  "american-football",
  "baseball",
  "basket",
  "bed",
  "bell",
  "book",
  "bookmark",
  "briefcase",
  "brush",
  "bug",
  "build",
  "cafe",
  "call",
  "card",
  "chat",
  "checkbox",
  "circle",
  "cloud",
  "code",
  "coins",
  "construct",
  "cutlery",
  "egg",
  "extension-puzzle",
  "eye",
  "fast-food",
  "fish",
  "flag",
  "flame",
  "flask",
  "folder",
  "game-controller",
  "globe",
  "globe-1",
  "grid-2x2",
  "grid-3x3",
  "heart",
  "ice-cream",
  "image",
  "inbox",
  "key",
  "layers",
  "leaf",
  "lightning",
  "location",
  "lock-closed",
  "logo-github",
  "logo-rss",
  "logo-usd",
  "mail",
  "map",
  "megaphone",
  "moon",
  "music",
  "navigate",
  "nuclear",
  "page",
  "palette",
  "paw",
  "people",
  "pizza",
  "planet",
  "present",
  "rocket",
  "school",
  "shapes",
  "shirt",
  "skull",
  "square",
  "squares",
  "star",
  "star-1",
  "stats-chart",
  "sun",
  "tada",
  "terminal",
  "ticket",
  "time",
  "trash",
  "triangle",
  "video",
  "volume-high",
  "wallet",
  "warning",
  "water",
  "weight",
];

describe("icon catalog coverage", () => {
  it("has a real adwaita-icon-theme file behind every mapped Firefox avatar icon name", () => {
    for (const [avatar, iconName] of Object.entries(FIREFOX_AVATAR_ICONS)) {
      expect(FIREFOX_STANDARD_AVATARS, `"${avatar}" is not a real Firefox avatar id`).toContain(
        avatar,
      );
      expect(iconName).toMatch(/-symbolic$/);
    }
  });

  it("has a real adwaita-icon-theme file behind every mapped Zen icon name", () => {
    for (const [icon, iconName] of Object.entries(ZEN_WORKSPACE_ICONS)) {
      expect(ZEN_SELECTABLE_ICONS, `"${icon}" is not a real Zen selectable icon id`).toContain(
        icon,
      );
      expect(iconName).toMatch(/-symbolic$/);
    }
  });

  it("doesn't silently drop a Firefox avatar that's since been mapped", () => {
    // If this ever fails, someone added a mapping without removing it from
    // the "Unmapped Firefox avatars" list in icon-catalog.ts's header comment.
    const header = readFileSync(resolve(process.cwd(), "src/icons/icon-catalog.ts"), "utf-8");
    const section = header.split("Unmapped Firefox avatars")[1]?.split("*/")[0] ?? "";
    const unmappedNames = new Set(section.match(/[\w-]+/g) ?? []);
    for (const avatar of Object.keys(FIREFOX_AVATAR_ICONS)) {
      expect(unmappedNames.has(avatar), `"${avatar}" is both mapped and listed as unmapped`).toBe(
        false,
      );
    }
  });
});

describe("resolveFirefoxIcon", () => {
  it("resolves a known avatar id regardless of context", () => {
    expect(resolveFirefoxIcon("star", "profile")).toBe(FIREFOX_AVATAR_ICONS.star);
    expect(resolveFirefoxIcon("star", "space")).toBe(FIREFOX_AVATAR_ICONS.star);
  });

  it("falls back to the browser icon for a profile with no mappable avatar", () => {
    expect(resolveFirefoxIcon("barbell", "profile")).toBe(BROWSER_FALLBACK_ICON);
    expect(resolveFirefoxIcon(undefined, "profile")).toBe(BROWSER_FALLBACK_ICON);
  });

  it("falls back to the neutral dot for a space with no mappable icon", () => {
    expect(resolveFirefoxIcon("barbell", "space")).toBe(SPACE_FALLBACK_ICON);
    expect(resolveFirefoxIcon(undefined, "space")).toBe(SPACE_FALLBACK_ICON);
  });
});

describe("resolveZenIcon", () => {
  it("resolves a known Zen-only icon id", () => {
    expect(resolveZenIcon("moon")).toBe(ZEN_WORKSPACE_ICONS.moon);
  });

  it("falls back to the neutral dot for an unmapped or missing id", () => {
    expect(resolveZenIcon("rocket")).toBe(SPACE_FALLBACK_ICON);
    expect(resolveZenIcon(undefined)).toBe(SPACE_FALLBACK_ICON);
  });
});
