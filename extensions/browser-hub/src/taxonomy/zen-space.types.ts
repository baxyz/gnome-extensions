/** One color of a Zen gradient theme. */
export type ZenGradientColor = {
  c: [number, number, number];
  isPrimary?: boolean;
};

/** A workspace as stored in zen-sessions.jsonlz4 */
export type ZenSpaceData = {
  uuid: string;
  name: string;
  /** chrome://browser/skin/zen-icons/selectable/<name>.svg */
  icon: string;
  /** Only "gradient" is supported. */
  theme?: {
    type?: string;
    gradientColors?: ZenGradientColor[];
  };
};
