import Adw from "gi://Adw";
import Gio from "gi://Gio";
import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";
import { SpaceType } from "./types/space-type.enum";

export default class BrowserHubPreferences extends ExtensionPreferences {
  async fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
    const settings = this.getSettings();

    const row = (title: string, subtitle: string, key: string): Adw.SwitchRow => {
      const r = new Adw.SwitchRow({ title, subtitle });
      settings.bind(key, r, "active", Gio.SettingsBindFlags.DEFAULT);
      return r;
    };

    const profilesGroup = new Adw.PreferencesGroup({ title: "Profiles" });
    profilesGroup.add(
      row("Firefox family", "Zen, Firefox, LibreWolf, Floorp…", "show-firefox-family"),
    );
    profilesGroup.add(row("Chrome family", "Chromium, Edge, Brave…", "show-chrome-family"));
    profilesGroup.add(
      row("Profile-less browsers", "GNOME Web, qutebrowser…", "show-simple-browsers"),
    );

    const spacesGroup = new Adw.PreferencesGroup({ title: "Spaces" });
    spacesGroup.add(
      row(
        "Firefox profile groups",
        "Profiles from Firefox's new in-browser switcher (128+) — separate from the classic Profile Manager",
        SpaceType.FirefoxProfileGroup,
      ),
    );
    spacesGroup.add(
      row("Zen workspaces", "Workspace buttons under each Zen profile", SpaceType.ZenWorkspace),
    );

    const page = new Adw.PreferencesPage();
    page.add(profilesGroup);
    page.add(spacesGroup);
    window.add(page);
  }
}
