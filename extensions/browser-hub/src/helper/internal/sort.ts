import { combineSortFns, createSortByBooleanFn, createSortByStringFn } from "@helpers4/array";

/** Comparator that sorts entries with isDefault=true first, then alphabetically by label. */
export const compareByDefault = combineSortFns<{ isDefault?: boolean; label: string }>(
  createSortByBooleanFn("isDefault"),
  createSortByStringFn("label"),
);
