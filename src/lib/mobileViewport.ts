/** Keep fixed mobile controls out of the on-screen keyboard on iOS Safari.
 * This observes visualViewport rather than assuming CSS dvh shrinks on focus.
 */
export function isKeyboardOccluding(
  layoutHeight: number,
  visualHeight: number,
  visualOffsetTop: number,
  focusedEditable: boolean
): boolean {
  return focusedEditable &&
    Number.isFinite(layoutHeight) &&
    Number.isFinite(visualHeight) &&
    layoutHeight - visualHeight - visualOffsetTop > 150;
}
function isEditableFocused(): boolean {
  const el = document.activeElement;
  if (el instanceof HTMLInputElement) {
    return !el.disabled && !el.readOnly && !['checkbox', 'radio', 'button', 'file', 'submit', 'reset', 'hidden'].includes(el.type);
  }
  if (el instanceof HTMLTextAreaElement) return !el.disabled && !el.readOnly;
  if (el instanceof HTMLSelectElement) return !el.disabled;
  return el instanceof HTMLElement && el.isContentEditable;
}
export function installMobileViewportObserver(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
  const root = document.documentElement;
  const viewport = window.visualViewport;
  const sync = () => {
    const height = viewport?.height ?? window.innerHeight;
    const top = viewport?.offsetTop ?? 0;
    root.style.setProperty('--visual-viewport-height', `${Math.round(height)}px`);
    root.style.setProperty('--visual-viewport-offset-top', `${Math.max(0, Math.round(top))}px`);
    root.classList.toggle('keyboard-open', isKeyboardOccluding(window.innerHeight, height, top, isEditableFocused()));
  };
  const onBlur = () => window.requestAnimationFrame(sync);
  viewport?.addEventListener('resize', sync);
  viewport?.addEventListener('scroll', sync);
  document.addEventListener('focusin', sync);
  document.addEventListener('focusout', onBlur);
  window.addEventListener('orientationchange', onBlur);
  window.addEventListener('pageshow', sync);
  sync();
  return () => {
    viewport?.removeEventListener('resize', sync);
    viewport?.removeEventListener('scroll', sync);
    document.removeEventListener('focusin', sync);
    document.removeEventListener('focusout', onBlur);
    window.removeEventListener('orientationchange', onBlur);
    window.removeEventListener('pageshow', sync);
    root.classList.remove('keyboard-open');
    root.style.removeProperty('--visual-viewport-height');
    root.style.removeProperty('--visual-viewport-offset-top');
  };
}
