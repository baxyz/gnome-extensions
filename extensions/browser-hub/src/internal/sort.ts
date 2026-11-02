import { combineSortFns, createSortByBooleanFn, createSortByStringFn } from "@helpers4/array";

/** Default first, then by label. */
export const compareByDefault = combineSortFns<{ isDefault?: boolean; label: string }>(
  createSortByBooleanFn("isDefault"),
  createSortByStringFn("label"),
);
