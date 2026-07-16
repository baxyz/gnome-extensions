// St.IconTheme is used by src/icons/resolve-icon.ts to check whether a
// candidate icon name is actually present in the current theme — this dev
// script has no real icon theme to check against, so assume every candidate
// exists (matches the test suite's own St.IconTheme mock pattern).
export default {
  IconTheme: class {
    has_icon(): boolean {
      return true;
    }
  },
};
export const Button = class {};
export const PopupMenuItem = class {};
export const PopupSeparatorMenuItem = class {};
export const Extension = class {};
export const notify = () => {};
