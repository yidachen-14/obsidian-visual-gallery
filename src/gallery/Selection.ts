export class CardSelection {
  readonly paths = new Set<string>();
  anchor: string | null = null;

  clear(): void { this.paths.clear(); this.anchor = null; }

  select(path: string, order: string[], modifiers: { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean } = {}): void {
    const additive = modifiers.metaKey || modifiers.ctrlKey;
    const anchorIndex = this.anchor === null ? -1 : order.indexOf(this.anchor);
    const index = order.indexOf(path);
    if (modifiers.shiftKey && anchorIndex >= 0 && index >= 0) {
      if (!additive) this.paths.clear();
      for (const key of order.slice(Math.min(index, anchorIndex), Math.max(index, anchorIndex) + 1)) this.paths.add(key);
    } else {
      if (!additive) this.paths.clear();
      if (additive && this.paths.has(path)) this.paths.delete(path);
      else this.paths.add(path);
      this.anchor = path;
    }
  }

  retain(order: string[]): void {
    const available = new Set(order);
    for (const path of this.paths) if (!available.has(path)) this.paths.delete(path);
    if (this.anchor && !available.has(this.anchor)) this.anchor = null;
  }
}
