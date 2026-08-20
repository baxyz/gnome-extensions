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
    // @girs/gnome-shell-49's bundled @girs/adw-1 beta (1.9.0-4.0.0-beta.40) has
    // an incomplete SpinRow type that fails to structurally match Gio.Settings
    // .bind()'s target param — a typings-only gap (real GNOME Shell 49 has no
    // such issue), reproduced with `tsc --project` pinned to that package.
    // Widened via `bind`'s own parameter type (rather than a separately
    // imported GObject.Object) so the cast always targets whichever
    // GObject.Object this exact tsc invocation actually resolved for Gio —
    // importing "gi://GObject" directly here resolved to a *different*,
    // incompatible GObject.Object on 46-48 instead of fixing anything.
    settings.bind(
      "timeout-seconds",
      row as unknown as Parameters<typeof settings.bind>[1],
      "value",
      Gio.SettingsBindFlags.DEFAULT,
    );
    group.add(row);

    const page = new Adw.PreferencesPage();
    page.add(group);
    window.add(page);
  }
}
