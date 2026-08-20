import Adw from "gi://Adw";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";
import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export default class QuickExitPreferences extends ExtensionPreferences {
  async fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
    const settings = this.getSettings();

    const group = new Adw.PreferencesGroup({
      title: "Countdown",
      description:
        "Applies to Log Out, Power Off, Restart, and Restart & Install Updates. Never waits longer than GNOME's own 60-second default — only shorter.",
    });

    const row = new Adw.SpinRow({
      title: "Timeout",
      subtitle: "Seconds before the dialog confirms on its own",
      adjustment: new Gtk.Adjustment({ lower: 1, upper: 60, stepIncrement: 1, pageIncrement: 5 }),
    });
    settings.bind("timeout-seconds", row, "value", Gio.SettingsBindFlags.DEFAULT);
    group.add(row);

    const page = new Adw.PreferencesPage();
    page.add(group);
    window.add(page);
  }
}
