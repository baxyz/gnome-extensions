import { delay } from "@helpers4/promise";

/**
 * The part of AbortSignal that @helpers4/promise reads. GJS has no
 * AbortController.
 */
export interface Cancellation {
  readonly aborted: boolean;
  readonly reason: unknown;
  addEventListener(type: "abort", listener: () => void, options?: { once?: boolean }): void;
  removeEventListener(type: "abort", listener: () => void): void;
}

export interface CancellationHandle {
  readonly signal: Cancellation;
  abort(reason?: unknown): void;
}

export function createCancellation(): CancellationHandle {
  const listeners = new Set<() => void>();
  const state = { aborted: false, reason: undefined as unknown };
  const signal: Cancellation = {
    get aborted() {
      return state.aborted;
    },
    get reason() {
      return state.reason;
    },
    addEventListener: (_type, listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener);
    },
  };
  return {
    signal,
    abort(reason = new Error("cancelled")) {
      if (state.aborted) return;
      state.aborted = true;
      state.reason = reason;
      for (const listener of listeners) listener();
      listeners.clear();
    },
  };
}

/** Waits `ms`. False if `signal` aborted first, in which case the timer is cleared. */
export async function pause(ms: number, signal?: Cancellation): Promise<boolean> {
  try {
    await delay(ms, undefined, { signal });
    return true;
  } catch {
    return false;
  }
}
