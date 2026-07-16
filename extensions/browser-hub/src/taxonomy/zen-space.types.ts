/** One entry of ZenSpaceData["theme"]["gradientColors"] — an RGB triple plus which one is primary. */
export type ZenGradientColor = {
  c: [number, number, number];
  isPrimary?: boolean;
};

/** Raw space data as stored in zen-sessions.jsonlz4 */
export type ZenSpaceData = {
  uuid: string;
  name: string;
  /** chrome://browser/skin/zen-icons/selectable/<name>.svg */
  icon: string;
  /** Zen's own workspace accent-color theme — only "gradient" is currently understood. */
  theme?: {
    type?: string;
    gradientColors?: ZenGradientColor[];
  };
};

/** Space with a fully built launch command (argv), ready for the menu */
export type ZenSpace = ZenSpaceData & {
  command: string[];
};
