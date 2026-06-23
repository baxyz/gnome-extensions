import Adw from "gi://Adw";
import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export default class BrowserHubPreferences extends ExtensionPreferences {
  async fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
    const profilesGroup = new Adw.PreferencesGroup({ title: "Profiles" });
    profilesGroup.add(
      new Adw.SwitchRow({
        title: "Firefox family",
        subtitle: "Zen, Firefox, LibreWolf, Floorp…",
      }),
    );
    profilesGroup.add(
      new Adw.SwitchRow({
        title: "Chrome family",
        subtitle: "Chromium, Edge, Brave…",
      }),
    );
    profilesGroup.add(
      new Adw.SwitchRow({
        title: "Profile-less browsers",
        subtitle: "GNOME Web, qutebrowser…",
      }),
    );

    const spacesGroup = new Adw.PreferencesGroup({ title: "Spaces" });
    spacesGroup.add(
      new Adw.SwitchRow({
        title: "Zen workspaces",
        subtitle: "Workspace buttons under each Zen profile",
      }),
    );

    const page = new Adw.PreferencesPage();
    page.add(profilesGroup);
    page.add(spacesGroup);
    window.add(page);
  }
}
