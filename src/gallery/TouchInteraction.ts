/** Long press only claims a completed hold. Scrolling/pinch gestures stay native. */
export class TouchInteraction {
  private hold: { id: number; x: number; y: number; target: HTMLElement; timer: ReturnType<typeof setTimeout> } | null = null;
  private suppressed: HTMLElement | null = null;
  private suppressTimer: ReturnType<typeof setTimeout> | null = null;
  constructor(private root: HTMLElement, private held: (card: HTMLElement, x: number, y: number) => void) {
    root.addEventListener("pointerdown", this.down);
    root.addEventListener("pointermove", this.move);
    root.addEventListener("pointerup", this.end);
    root.addEventListener("pointercancel", this.end);
    root.addEventListener("scroll", this.cancelHold, true);
    root.addEventListener("click", this.click, true);
    root.addEventListener("contextmenu", this.context, true);
  }
  private down = (event: PointerEvent): void => {
    const busy = !!this.hold;
    this.cancelHold();
    if (busy || !event.isPrimary || event.button !== 0 || !["touch", "pen"].includes(event.pointerType)) return;
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>(".visual-gallery-card") : null;
    if (!target) return;
    this.hold = { id: event.pointerId, x: event.clientX, y: event.clientY, target, timer: setTimeout(() => this.fire(), 550) };
  };
  private fire(): void {
    const hold = this.hold;
    this.cancelHold();
    if (!hold || !hold.target.isConnected) return;
    this.suppressed = hold.target;
    if (this.suppressTimer) clearTimeout(this.suppressTimer);
    this.suppressTimer = null;
    this.held(hold.target, hold.x, hold.y);
  }
  private end = (): void => {
    this.cancelHold();
    if (this.suppressed) {
      if (this.suppressTimer) clearTimeout(this.suppressTimer);
      this.suppressTimer = setTimeout(() => { this.suppressed = null; this.suppressTimer = null; }, 1500);
    }
  };
  private move = (event: PointerEvent): void => {
    if (this.hold && (event.pointerId !== this.hold.id || Math.hypot(event.clientX - this.hold.x, event.clientY - this.hold.y) > 10)) this.cancelHold();
  };
  private cancelHold = (): void => {
    if (this.hold) clearTimeout(this.hold.timer);
    this.hold = null;
  };
  private click = (event: MouseEvent): void => {
    if (this.suppressed && event.target instanceof Node && this.suppressed.contains(event.target)) {
      event.preventDefault(); event.stopImmediatePropagation(); this.suppressed = null;
    }
  };
  private context = (event: MouseEvent): void => {
    // iOS/Android may emit a native contextmenu before or after our hold timer.
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>(".visual-gallery-card") : null;
    if (target && (this.hold?.target === target || this.suppressed === target)) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (this.hold?.target === target) this.fire();
    }
  };
  reset(): void {
    this.cancelHold(); this.suppressed = null;
    if (this.suppressTimer) clearTimeout(this.suppressTimer);
    this.suppressTimer = null;
  }
  dispose(): void {
    this.reset();
    this.root.removeEventListener("pointerdown", this.down);
    this.root.removeEventListener("pointermove", this.move);
    this.root.removeEventListener("pointerup", this.end);
    this.root.removeEventListener("pointercancel", this.end);
    this.root.removeEventListener("scroll", this.cancelHold, true);
    this.root.removeEventListener("click", this.click, true);
    this.root.removeEventListener("contextmenu", this.context, true);
  }
}
