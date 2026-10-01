export interface SelectionRect { left: number; top: number; right: number; bottom: number; }

export function selectionRect(x1: number, y1: number, x2: number, y2: number): SelectionRect {
  return { left: Math.min(x1, x2), top: Math.min(y1, y2), right: Math.max(x1, x2), bottom: Math.max(y1, y2) };
}

export function intersects(a: SelectionRect, b: SelectionRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export function marqueePaths(hits: string[], base: Set<string>, additive: boolean, toggle: boolean): Set<string> {
  const paths = additive || toggle ? new Set(base) : new Set<string>();
  for (const path of hits) {
    if (toggle && base.has(path)) paths.delete(path);
    else paths.add(path);
  }
  return paths;
}

// These are controls/content, not blank space. Shell padding, grid gaps, the
// empty-state background and the unused area below the grid remain selectable.
export function isGalleryBlank(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && !target.closest(
    'button,input,select,textarea,a,[contenteditable=true],.visual-gallery-card,.visual-gallery-header,.visual-gallery-breadcrumbs',
  );
}

interface Session {
  pointerId: number;
  startX: number;
  startY: number;
  clientX: number;
  clientY: number;
  base: Set<string>;
  additive: boolean;
  toggle: boolean;
  moved: boolean;
  overlay: HTMLElement;
  contentWidth: number;
  contentHeight: number;
}

export class MarqueeSelection {
  private session: Session | null = null;
  private frame: number | null = null;
  private suppressClick = false;
  private clickTimer: number | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly getSelected: () => Set<string>,
    private readonly setSelected: (paths: Set<string>) => void,
  ) {
    root.addEventListener('pointerdown', this.onDown);
    root.addEventListener('pointermove', this.onMove);
    root.addEventListener('pointerup', this.onUp);
    root.addEventListener('pointercancel', this.onCancel);
    root.addEventListener('lostpointercapture', this.onCancel);
    root.addEventListener('click', this.onClick, true);
  }

  private point(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.root.getBoundingClientRect();
    return { x: clientX - rect.left + this.root.scrollLeft, y: clientY - rect.top + this.root.scrollTop };
  }

  private onDown = (event: PointerEvent): void => {
    if (event.button !== 0 || event.pointerType === 'touch' || !isGalleryBlank(event.target)) return;
    const viewport = this.root.getBoundingClientRect();
    if (event.clientX >= viewport.left + this.root.clientWidth || event.clientY >= viewport.top + this.root.clientHeight) return;
    this.cancel();
    event.preventDefault();
    this.root.focus({ preventScroll: true });
    const start = this.point(event.clientX, event.clientY);
    const overlay = document.createElement('div');
    overlay.className = 'visual-gallery-marquee';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.hidden = true;
    this.root.appendChild(overlay);
    this.session = {
      pointerId: event.pointerId, startX: start.x, startY: start.y,
      clientX: event.clientX, clientY: event.clientY,
      base: new Set(this.getSelected()), additive: event.shiftKey,
      toggle: event.metaKey || event.ctrlKey, moved: false, overlay,
      contentWidth: this.root.scrollWidth, contentHeight: this.root.scrollHeight,
    };
    this.root.setPointerCapture(event.pointerId);
  };

  private onMove = (event: PointerEvent): void => {
    const session = this.session;
    if (!session || session.pointerId !== event.pointerId) return;
    session.clientX = event.clientX;
    session.clientY = event.clientY;
    const point = this.point(event.clientX, event.clientY);
    if (!session.moved && Math.hypot(point.x - session.startX, point.y - session.startY) < 4) return;
    session.moved = true;
    this.root.classList.add('is-marquee-selecting');
    this.update();
    if (this.frame === null) this.frame = window.requestAnimationFrame(this.autoScroll);
  };

  private update(): void {
    const session = this.session;
    if (!session?.moved) return;
    const viewport = this.root.getBoundingClientRect();
    const point = this.point(
      Math.max(viewport.left, Math.min(viewport.left + this.root.clientWidth, session.clientX)),
      Math.max(viewport.top, Math.min(viewport.top + this.root.clientHeight, session.clientY)),
    );
    point.x = Math.max(0, Math.min(session.contentWidth, point.x));
    point.y = Math.max(0, Math.min(session.contentHeight, point.y));
    const rect = selectionRect(session.startX, session.startY, point.x, point.y);
    session.overlay.hidden = false;
    session.overlay.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.right - rect.left}px;height:${rect.bottom - rect.top}px;`;
    const hits: string[] = [];
    const origin = this.root.getBoundingClientRect();
    for (const card of Array.from(this.root.querySelectorAll<HTMLElement>('.visual-gallery-card'))) {
      const bounds = card.getBoundingClientRect();
      const offsetX = this.root.scrollLeft - origin.left;
      const offsetY = this.root.scrollTop - origin.top;
      if (card.dataset.itemPath && intersects(rect, {
        left: bounds.left + offsetX, right: bounds.right + offsetX,
        top: bounds.top + offsetY, bottom: bounds.bottom + offsetY,
      })) hits.push(card.dataset.itemPath);
    }
    this.setSelected(marqueePaths(hits, session.base, session.additive, session.toggle));
  }

  private autoScroll = (): void => {
    this.frame = null;
    const session = this.session;
    if (!session?.moved) return;
    const rect = this.root.getBoundingClientRect();
    const velocity = (point: number, min: number, max: number) => point < min + 32 ? -14 : point > max - 32 ? 14 : 0;
    this.root.scrollTop = Math.max(0, Math.min(session.contentHeight - this.root.clientHeight, this.root.scrollTop + velocity(session.clientY, rect.top, rect.bottom)));
    this.root.scrollLeft = Math.max(0, Math.min(session.contentWidth - this.root.clientWidth, this.root.scrollLeft + velocity(session.clientX, rect.left, rect.right)));
    this.update();
    this.frame = window.requestAnimationFrame(this.autoScroll);
  };

  private onUp = (event: PointerEvent): void => {
    if (!this.session || this.session.pointerId !== event.pointerId) return;
    if (this.session.moved) {
      this.session.clientX = event.clientX;
      this.session.clientY = event.clientY;
      this.update();
    } else this.setSelected(new Set());
    this.suppressClick = true;
    if (this.clickTimer !== null) window.clearTimeout(this.clickTimer);
    this.clickTimer = window.setTimeout(() => { this.suppressClick = false; this.clickTimer = null; }, 0);
    this.end();
  };

  private onClick = (event: MouseEvent): void => {
    if (this.suppressClick) {
      this.suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    } else if (isGalleryBlank(event.target)) this.setSelected(new Set());
  };

  private onCancel = (): void => this.cancel();

  cancel(): void {
    if (this.session) this.setSelected(this.session.base);
    this.end();
  }

  private end(): void {
    const session = this.session;
    this.session = null;
    session?.overlay.remove();
    this.root.classList.remove('is-marquee-selecting');
    if (this.frame !== null) window.cancelAnimationFrame(this.frame);
    this.frame = null;
    if (session && this.root.hasPointerCapture(session.pointerId)) this.root.releasePointerCapture(session.pointerId);
  }

  dispose(): void {
    this.cancel();
    if (this.clickTimer !== null) window.clearTimeout(this.clickTimer);
    this.root.removeEventListener('pointerdown', this.onDown);
    this.root.removeEventListener('pointermove', this.onMove);
    this.root.removeEventListener('pointerup', this.onUp);
    this.root.removeEventListener('pointercancel', this.onCancel);
    this.root.removeEventListener('lostpointercapture', this.onCancel);
    this.root.removeEventListener('click', this.onClick, true);
  }
}
