import { Extension, InjectionManager } from "resource:///org/gnome/shell/extensions/extension.js";
import { EndSessionDialog } from "resource:///org/gnome/shell/ui/endSessionDialog.js";
import { clampTimeout } from "./clamp-timeout";

export default class QuickExitExtension extends Extension {
  private _injectionManager: InjectionManager | null = null;

  enable() {
    const settings = this.getSettings();
    this._injectionManager = new InjectionManager();

    // GNOME's own EndSessionDialog._startTimer() already reads
    // _totalSecondsToStayOpen and ticks _secondsLeft down every second,
    // updating the dialog's own countdown text as it goes — clamping that
    // value down before letting the original method run is enough to shorten
    // the wait, with none of the UI/wording duplicated (and so nothing here
    // to fall out of sync with it across GNOME Shell versions).
    this._injectionManager.overrideMethod(
      EndSessionDialog.prototype,
      "_startTimer",
      (originalStartTimer) =>
        function (this: EndSessionDialog) {
          this._totalSecondsToStayOpen = clampTimeout(
            this._totalSecondsToStayOpen,
            settings.get_int("timeout-seconds"),
          );
          return originalStartTimer.call(this);
        },
    );
  }

  disable() {
    this._injectionManager?.clear();
    this._injectionManager = null;
  }
}
