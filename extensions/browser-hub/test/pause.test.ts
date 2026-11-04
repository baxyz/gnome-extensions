import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("gi://GLib", () => ({
  default: {
    PRIORITY_DEFAULT: 0,
    SOURCE_REMOVE: false,
    timeout_add: (_priority: number, ms: number, cb: () => boolean) =>
      setTimeout(cb, ms) as unknown as number,
    source_remove: (id: number) => clearTimeout(id),
  },
}));

const { pause, cancelPauses } = await import("../src/internal/pause");

describe("pause", () => {
  afterEach(() => vi.useRealTimers());

  it("resolves true once the timeout has elapsed", async () => {
    vi.useFakeTimers();
    const done = pause(30);
    await vi.advanceTimersByTimeAsync(30);
    await expect(done).resolves.toBe(true);
  });

  it("resolves false and removes the timeout when cancelled mid-wait", async () => {
    vi.useFakeTimers();
    const done = pause(30);
    expect(vi.getTimerCount()).toBe(1);
    cancelPauses();
    await expect(done).resolves.toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("leaves nothing to cancel once a pause has elapsed", async () => {
    vi.useFakeTimers();
    const done = pause(30);
    await vi.advanceTimersByTimeAsync(30);
    await done;
    cancelPauses();
    expect(vi.getTimerCount()).toBe(0);
  });
});
