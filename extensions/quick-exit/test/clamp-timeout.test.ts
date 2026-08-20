import { describe, it, expect } from "vitest";
import { clampTimeout } from "../src/clamp-timeout";

describe("clampTimeout", () => {
  it("shortens GNOME's native countdown to the configured value", () => {
    expect(clampTimeout(60, 1)).toBe(1);
    expect(clampTimeout(60, 5)).toBe(5);
  });

  it("never lengthens a countdown GNOME already set shorter than configured", () => {
    expect(clampTimeout(10, 30)).toBe(10);
  });

  it("passes an equal value through unchanged", () => {
    expect(clampTimeout(30, 30)).toBe(30);
  });
});
