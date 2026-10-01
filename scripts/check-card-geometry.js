/* Run in the actual Obsidian console, or evaluate with installed host CSS in ego.
 * This checks BOTH the ordinary stroke and selection/drop stroke. Rectangles
 * alone cannot detect an inset rounded stroke, so compare all inner radii too.
 * Returns diagnostics; the caller must reject nonzero failures. No vault writes.
 */
(() => {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none;';
  document.body.append(host);
  const failures = [], records = [];
  const close = (a, b) => Math.abs(a - b) < 0.05;
  try {
    for (const theme of ['theme-light', 'theme-dark']) {
      host.className = theme;
      for (const zoom of [1, 1.25, 1.5]) {
        host.style.zoom = String(zoom);
        for (const width of [180, 190, 210, 220, 250, 360]) {
          for (const metadata of [false, true]) {
            for (const state of ['', 'is-selected', 'is-drop-target']) {
              host.innerHTML = '<div class="visual-gallery-view"><div class="visual-gallery-grid"></div></div>';
              const view = host.firstElementChild;
              view.style.setProperty('--vg-card-width', width + 'px');
              const grid = view.firstElementChild;
              grid.style.gridTemplateColumns = `repeat(3, ${width}px)`;
              for (const title of ['Sidebar-Target', '中英 mixed title that wraps onto multiple lines', '測試']) {
                const card = document.createElement('button');
                card.className = 'visual-gallery-card ' + state;
                card.innerHTML = '<div class="visual-gallery-card-surface"><div class="visual-gallery-preview is-folder"></div><div class="visual-gallery-card-details"><div class="visual-gallery-card-title"></div>' + (metadata ? '<div class="visual-gallery-card-meta">資料夾</div>' : '') + '</div></div>';
                card.querySelector('.visual-gallery-card-title').textContent = title;
                grid.append(card);
              }
              for (const card of grid.children) {
                const style = getComputedStyle(card), ring = getComputedStyle(card, '::before');
                const after = getComputedStyle(card, '::after');
                const surface = card.querySelector('.visual-gallery-card-surface');
                const surfaceStyle = getComputedStyle(surface);
                const rect = card.getBoundingClientRect(), sr = surface.getBoundingClientRect();
                const errors = [];
                const expectedWidth = state ? 2 : 1;
                const shadow = ring.boxShadow.replace(/rgba?\([^)]*\)/g, '').trim().split(/\s+/).map(parseFloat);
                if (shadow.length !== 4 || !close(shadow[0], 0) || !close(shadow[1], 0) || !close(shadow[2], 0) || !close(shadow[3], expectedWidth)) errors.push('Stroke is not a single zero-blur outside spread');
                for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
                  const strokeWidth = parseFloat(ring['border' + side + 'Width']);
                  const offset = parseFloat(ring[side.toLowerCase()]);
                  if (!close(strokeWidth, 0) || !close(offset, 0)) errors.push(side + ': stroke base differs from surface');
                }
                for (const corner of ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft']) {
                  const radius = parseFloat(surfaceStyle['border' + corner + 'Radius']);
                  const innerRadius = parseFloat(ring['border' + corner + 'Radius']);
                  if (!close(innerRadius, radius)) errors.push(corner + ': inner stroke radius differs from surface');
                }
                if (!['none', 'normal'].includes(after.content)) errors.push('Second outline layer present');
                if (ring.boxSizing !== 'border-box') errors.push('Stroke sizing not explicit');
                if (style.overflow !== 'visible' || parseFloat(style.borderTopWidth) !== 0 || parseFloat(style.paddingTop) !== 0) errors.push('Card clips or adds layout border/padding');
                if (!close(rect.width / zoom, width)) errors.push('Width mismatch');
                for (const side of ['top', 'right', 'bottom', 'left']) if (!close(rect[side], sr[side])) errors.push('Surface does not reach ' + side);
                if (style.boxShadow === 'none') errors.push('Shadow missing');
                const record = {theme, zoom, width, metadata, state: state || 'normal', title: card.querySelector('.visual-gallery-card-title').textContent};
                records.push(record);
                if (errors.length) failures.push({...record, errors});
              }
            }
          }
        }
      }
    }
  } finally { host.remove(); }
  return {checked: records.length, failures: failures.length, examples: failures.slice(0, 4)};
})();
