const STORAGE_KEY_LEFT = 'splithistory.leftPanelWidth';
const STORAGE_KEY_RIGHT = 'splithistory.rightPanelWidth';
const MIN_WIDTH = 220;
const MAX_WIDTH = 560;
const DEFAULT_WIDTH = 300;

function loadWidth(key) {
  try {
    const raw = localStorage.getItem(key);
    const value = raw ? Number(raw) : NaN;
    return Number.isFinite(value) ? Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value)) : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

function saveWidth(key, value) {
  try { localStorage.setItem(key, String(value)); } catch { /* приватный режим и т.п. — не критично */ }
}

function makeDraggable(handle, onDrag, onEnd) {
  let dragging = false;
  handle.addEventListener('pointerdown', (e) => {
    dragging = true;
    handle.classList.add('dragging');
    handle.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  handle.addEventListener('pointermove', (e) => {
    if (dragging) onDrag(e);
  });
  const stop = () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    onEnd();
  };
  handle.addEventListener('pointerup', stop);
  handle.addEventListener('pointercancel', stop);
}

/** Позволяет тащить границы левой/правой панели мышью; ширина запоминается между запусками. */
export function initPanelResize() {
  const app = document.getElementById('app');
  const leftHandle = document.getElementById('resize-handle-left');
  const rightHandle = document.getElementById('resize-handle-right');

  let leftWidth = loadWidth(STORAGE_KEY_LEFT);
  let rightWidth = loadWidth(STORAGE_KEY_RIGHT);
  let resizeDispatchScheduled = false;

  function scheduleWindowResizeEvent() {
    if (resizeDispatchScheduled) return;
    resizeDispatchScheduled = true;
    requestAnimationFrame(() => {
      resizeDispatchScheduled = false;
      // 3D-сцена и 2D-канвас уже слушают window resize — переиспользуем это вместо новых колбэков.
      window.dispatchEvent(new Event('resize'));
    });
  }

  function apply() {
    app.style.gridTemplateColumns = `${leftWidth}px 1fr ${rightWidth}px`;
    leftHandle.style.left = `${leftWidth - 3}px`;
    rightHandle.style.right = `${rightWidth - 3}px`;
    scheduleWindowResizeEvent();
  }

  makeDraggable(leftHandle, (e) => {
    leftWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
    apply();
  }, () => saveWidth(STORAGE_KEY_LEFT, leftWidth));

  makeDraggable(rightHandle, (e) => {
    rightWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - e.clientX));
    apply();
  }, () => saveWidth(STORAGE_KEY_RIGHT, rightWidth));

  apply();
}
