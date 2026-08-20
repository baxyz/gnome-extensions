/**
 * Never lets the dialog wait longer than GNOME itself requested — only
 * shorter. If a future GNOME version ever asks for a shorter wait than the
 * configured timeout, that shorter wait wins.
 */
export function clampTimeout(nativeSeconds: number, configuredSeconds: number): number {
  return Math.min(nativeSeconds, configuredSeconds);
}
