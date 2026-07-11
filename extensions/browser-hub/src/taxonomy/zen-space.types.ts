/** Raw space data as stored in zen-sessions.jsonlz4 */
export type ZenSpaceData = {
  uuid: string;
  name: string;
  /** chrome://browser/skin/zen-icons/selectable/<name>.svg */
  icon: string;
};

/** Space with a fully built launch command (argv), ready for the menu */
export type ZenSpace = ZenSpaceData & {
  command: string[];
};
