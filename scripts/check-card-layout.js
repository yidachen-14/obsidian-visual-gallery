/* Run in Obsidian's developer console after loading the plugin CSS.
   Uses the real host button rules and browser layout, not a DOM mock. */
(() => {
  const failures = [];
  const measurements = [];
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none;';
  document.body.append(host);
  try {
    for (const theme of ['theme-light', 'theme-dark']) {
      host.className = theme;
      for (const width of [180, 210, 220, 250, 360]) {
        for (const metadata of [false, true]) {
          host.replaceChildren();
          const view = host.appendChild(document.createElement('div'));
          view.className = 'visual-gallery-view';
          view.style.setProperty('--vg-card-width', `${width}px`);
          const grid = view.appendChild(document.createElement('div'));
          grid.className = 'visual-gallery-grid';
          grid.style.gridTemplateColumns = `repeat(3, ${width}px)`;
          for (const [index, title] of ['測試', 'plain-note', '中英 mixed title'].entries()) {
            const card = grid.appendChild(document.createElement('button'));
            card.className = 'visual-gallery-card';
            if (index === 2) card.classList.add('is-selected');
            const surface = card.appendChild(document.createElement('div'));
            surface.className = 'visual-gallery-card-surface';
            const preview = surface.appendChild(document.createElement('div'));
            preview.className = 'visual-gallery-preview';
            const note = preview.appendChild(document.createElement('div'));
            note.className = 'visual-gallery-note-preview';
            note.textContent = 'Preview';
            const details = surface.appendChild(document.createElement('div'));
            details.className = 'visual-gallery-card-details';
            const label = details.appendChild(document.createElement('div'));
            label.className = 'visual-gallery-card-title';
            label.textContent = title;
            if (metadata && index !== 2) {
              const meta = details.appendChild(document.createElement('div'));
              meta.className = 'visual-gallery-card-meta';
              meta.textContent = index === 0 ? '筆記 · 9月30日' : 'Note · Sep 30';
            }
          }
          for (const card of grid.children) {
            const rect = card.getBoundingClientRect();
            const preview = card.querySelector('.visual-gallery-preview').getBoundingClientRect();
            const details = card.querySelector('.visual-gallery-card-details').getBoundingClientRect();
            const style = getComputedStyle(card);
            const topGap = preview.top - rect.top - parseFloat(style.borderTopWidth);
            const bottomGap = rect.bottom - details.bottom - parseFloat(style.borderBottomWidth);
            const record = { theme, width, metadata, title: card.textContent, topGap, bottomGap, actualWidth: rect.width, shadow: style.boxShadow };
            measurements.push(record);
            if (Math.abs(topGap) > 0.05 || Math.abs(bottomGap) > 0.05 || Math.abs(rect.width - width) > 0.05 || style.boxShadow === 'none') failures.push(record);
          }
        }
      }
    }
  } finally {
    host.remove();
  }
  if (failures.length) throw new Error(JSON.stringify({ failures }));
  console.log(JSON.stringify({ passed: measurements.length, maxTopGap: Math.max(...measurements.map(m => Math.abs(m.topGap))), maxBottomGap: Math.max(...measurements.map(m => Math.abs(m.bottomGap))), widths: [...new Set(measurements.map(m => m.actualWidth))], shadows: 'present on every card' }));
})();
