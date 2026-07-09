/** Runs promises concurrently; logs and drops any that reject instead of failing the whole batch. */
export async function settleAll<T>(promises: Promise<T>[], context: string): Promise<T[]> {
  const results = await Promise.allSettled(promises);
  return results.flatMap((r) => {
    if (r.status === "rejected") {
      logError(r.reason as object, context);
      return [];
    }
    return [r.value];
  });
}
