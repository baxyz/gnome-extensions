import { delay } from "@helpers4/promise";

/**
 * The part of `AbortSignal` that @helpers4/promise reads. GJS has no global
 * AbortController, and `delay` only needs these four members, so a minimal
 * handle is enough to let teardown clear a pending timer.
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

/**
 * Waits `ms`, clearing the timer as soon as `signal` aborts so nothing is
 * left pending after disable(). Resolves true once the wait is over, false
 * when it was cancelled — callers just stop, there is nothing to handle.
 */
export async function pause(ms: number, signal?: Cancellation): Promise<boolean> {
  try {
    await delay(ms, undefined, { signal });
    return true;
  } catch {
    return false;
  }
}
