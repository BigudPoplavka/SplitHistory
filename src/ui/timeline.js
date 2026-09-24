import { store, setTimeline, setTimelineScale, panTimeline, resetTimelineView } from '../store.js';
import { formatYear } from '../utils.js';

let dragging = null;

export function initTimeline() {
  document.getElementById('timeline-handle-from').addEventListener('pointerdown', (e) => { dragging = 'from'; e.preventDefault(); });
  document.getElementById('timeline-handle-to').addEventListener('pointerdown', (e) => { dragging = 'to'; e.preventDefault(); });
  window.addEventListener('pointermove', onDrag);
  window.addEventListener('pointerup', () => { dragging = null; });

  for (const btn of document.querySelectorAll('.timeline-scale-btn')) {
    btn.addEventListener('click', () => {
      const span = Number(btn.dataset.span);
      if (span) setTimelineScale(span);
      else resetTimelineView();
    });
  }

  document.getElementById('timeline-pan-left').addEventListener('click', () => panTimeline(-1));
  document.getElementById('timeline-pan-right').addEventListener('click', () => panTimeline(1));
}

function onDrag(e) {
  if (!dragging) return;
  const track = document.getElementById('timeline-track');
  const rect = track.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  const { viewMin, viewMax, from, to } = store.timeline;
  const value = Math.round(viewMin + ratio * (viewMax - viewMin));
  if (dragging === 'from') setTimeline({ from: Math.min(value, to) });
  else setTimeline({ to: Math.max(value, from) });
}

export function renderTimeline() {
  const { viewMin, viewMax, from, to } = store.timeline;
  const span = Math.max(1, viewMax - viewMin);
  const clamp = (v) => Math.min(100, Math.max(0, v));
  const fromPct = clamp(((from - viewMin) / span) * 100);
  const toPct = clamp(((to - viewMin) / span) * 100);

  document.getElementById('timeline-range').style.left = `${fromPct}%`;
  document.getElementById('timeline-range').style.width = `${Math.max(0, toPct - fromPct)}%`;
  document.getElementById('timeline-handle-from').style.left = `${fromPct}%`;
  document.getElementById('timeline-handle-to').style.left = `${toPct}%`;
  document.getElementById('timeline-readout').textContent =
    `${formatYear(from)} — ${formatYear(to)}  (видно: ${formatYear(viewMin)} — ${formatYear(viewMax)})`;

  const ticksEl = document.getElementById('timeline-ticks');
  ticksEl.innerHTML = '';
  const tickCount = 6;
  for (let i = 0; i <= tickCount; i++) {
    const value = viewMin + (span * i) / tickCount;
    const tick = document.createElement('span');
    tick.className = 'timeline-tick';
    tick.style.left = `${(i / tickCount) * 100}%`;
    tick.textContent = formatYear(Math.round(value));
    ticksEl.appendChild(tick);
  }
}
