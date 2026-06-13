import { PackageManager } from "../constants/package-manager.enum";

export type NativePkg  = { manager: PackageManager.Native;  binary: string };
export type FlatpakPkg = { manager: PackageManager.Flatpak; appId: string  };
export type SnapPkg    = { manager: PackageManager.Snap;    name: string   };

export type BrowserPkg = NativePkg | FlatpakPkg | SnapPkg;
