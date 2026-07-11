import type { SpaceType } from "./space-type.enum";

export type ProfileGroupsMode = "spaces" | "profiles" | "off";

export type FirefoxOptions = {
  enabledSpaces: ReadonlySet<SpaceType>;
  profileGroupsMode: ProfileGroupsMode;
};
