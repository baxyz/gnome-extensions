import { Extension, InjectionManager } from "resource:///org/gnome/shell/extensions/extension.js";
import { EndSessionDialog } from "resource:///org/gnome/shell/ui/endSessionDialog.js";

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
          // Clamp the timeout.
          // Never lets the dialog wait longer than GNOME itself requested — only
          // shorter. If a future GNOME version ever asks for a shorter wait than
          // the configured timeout, that shorter wait wins.
          this._totalSecondsToStayOpen = Math.min(
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
