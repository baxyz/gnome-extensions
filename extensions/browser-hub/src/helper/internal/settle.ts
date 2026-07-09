import { settle } from "@helpers4/promise";

/** Runs promises concurrently; logs and drops any that reject instead of failing the whole batch. */
export async function settleAll<T>(promises: Promise<T>[], context: string): Promise<T[]> {
  const { fulfilled, rejected } = await settle(promises);
  for (const reason of rejected) {
    logError(reason as object, context);
  }
  return fulfilled;
}
