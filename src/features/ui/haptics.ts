/**
 * Optional vibration. Browsers only allow it after the person has tapped the
 * page, so skip silently otherwise (and on devices without it).
 */
export function vibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } })
    .userActivation;
  if (activation && !activation.hasBeenActive) return;
  navigator.vibrate(pattern);
}
