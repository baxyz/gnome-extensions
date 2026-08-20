import { Extension, InjectionManager } from "resource:///org/gnome/shell/extensions/extension.js";
import { EndSessionDialog } from "resource:///org/gnome/shell/ui/endSessionDialog.js";
import { clampTimeout } from "./clamp-timeout";

export default class QuickExitExtension extends Extension {
  private _injectionManager: InjectionManager | null = null;

  enable() {
    const settings = this.getSettings();
    this._injectionManager = new InjectionManager();

    // _startTimer() ticks _secondsLeft down from _totalSecondsToStayOpen once
    // per second and redraws the dialog's countdown text from it. Shrinking
    // _totalSecondsToStayOpen here, before the original method runs, is what
    // shortens the wait.
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
