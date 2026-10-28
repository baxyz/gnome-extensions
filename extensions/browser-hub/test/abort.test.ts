import { afterEach, describe, expect, it, vi } from "vitest";
import { createCancellation, pause } from "../src/internal/abort";

describe("pause", () => {
  afterEach(() => vi.useRealTimers());

  it("resolves true once the delay has elapsed", async () => {
    vi.useFakeTimers();
    const done = pause(30, createCancellation().signal);
    await vi.advanceTimersByTimeAsync(30);
    await expect(done).resolves.toBe(true);
  });

  it("resolves false and clears the timer when aborted mid-wait", async () => {
    vi.useFakeTimers();
    const handle = createCancellation();
    const done = pause(30, handle.signal);
    expect(vi.getTimerCount()).toBe(1);
    handle.abort();
    await expect(done).resolves.toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("resolves false without arming a timer when already aborted", async () => {
    vi.useFakeTimers();
    const handle = createCancellation();
    handle.abort();
    await expect(pause(30, handle.signal)).resolves.toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("waits normally with no signal", async () => {
    vi.useFakeTimers();
    const done = pause(30);
    await vi.advanceTimersByTimeAsync(30);
    await expect(done).resolves.toBe(true);
  });
});
