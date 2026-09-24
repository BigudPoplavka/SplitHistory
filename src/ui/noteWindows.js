import { store, getNote, updateNote, deleteNote, addNote, syncLinksFromContent, setSelection } from '../store.js';
import { TYPE_LABELS, parseTagsInput, resolveWikiLinks } from '../utils.js';
import { showContextMenu } from './contextMenu.js';

const windows = new Map();
let zCounter = 20;
let cascadeCount = 0;

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function setValueIfNotFocused(el, value) {
  if (document.activeElement !== el && el.value !== String(value)) el.value = value;
}

function nextPosition() {
  const baseX = 340;
  const baseY = 90;
  const step = 32;
  const i = cascadeCount % 8;
  cascadeCount += 1;
  return { x: baseX + i * step, y: baseY + i * step };
}

export function openNoteWindow(noteId) {
  const note = getNote(noteId);
  if (!note) return;
  let win = windows.get(noteId);
  if (!win) {
    win = createWindowDom(note);
    windows.set(noteId, win);
  }
  win.minimized = false;
  win.el.classList.remove('hidden');
  focusWindow(noteId);
  renderDock();
}

export function createNoteWindow(layerId) {
  const fallbackLayer = layerId
    || store.data.layers.find((l) => l.kind !== 'map')?.id
    || store.data.layers[0]?.id;
  const note = addNote({ title: 'Новая заметка', layerId: fallbackLayer, type: 'event' });
  openNoteWindow(note.id);
  const win = windows.get(note.id);
  requestAnimationFrame(() => { win.refs.title.focus(); win.refs.title.select(); });
}

export function renderNoteWindows() {
  for (const [noteId, win] of [...windows]) {
    const note = getNote(noteId);
    if (!note) { closeWindow(noteId); continue; }
    syncWindowChrome(win, note);
  }
  renderDock();
}

function closeWindow(noteId) {
  const win = windows.get(noteId);
  if (!win) return;
  win.el.remove();
  windows.delete(noteId);
  renderDock();
}

function minimizeWindow(noteId) {
  const win = windows.get(noteId);
  if (!win) return;
  win.minimized = true;
  win.el.classList.add('hidden');
  renderDock();
}

function focusWindow(noteId) {
  const win = windows.get(noteId);
  if (!win) return;
  zCounter += 1;
  win.el.style.zIndex = String(zCounter);
}

function renderDock() {
  const dock = document.getElementById('note-tabs-dock');
  if (!dock) return;
  dock.innerHTML = '';
  if (windows.size === 0) { dock.classList.add('hidden'); return; }
  dock.classList.remove('hidden');
  for (const [noteId, win] of windows) {
    const note = getNote(noteId);
    if (!note) continue;
    const tab = document.createElement('button');
    tab.className = 'note-tab' + (win.minimized ? ' minimized' : '');
    tab.title = note.title || 'Без названия';
    tab.textContent = note.title || 'Без названия';
    tab.addEventListener('click', () => openNoteWindow(noteId));

    const closeBtn = document.createElement('span');
    closeBtn.className = 'note-tab-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeWindow(noteId); });

    tab.appendChild(closeBtn);
    dock.appendChild(tab);
    win.dockBtn = tab;
  }
}

function createWindowDom(note) {
  const { x, y } = nextPosition();
  const el = document.createElement('div');
  el.className = 'note-window';
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.width = '460px';
  el.style.height = '540px';

  el.innerHTML = `
    <div class="note-window-titlebar">
      <span class="note-window-title-label"></span>
      <div class="note-window-actions">
        <button class="nw-btn nw-minimize" title="Свернуть">–</button>
        <button class="nw-btn nw-close" title="Закрыть">×</button>
      </div>
    </div>
    <div class="note-window-body">
      <input class="nw-title" type="text" placeholder="Название заметки" />
      <input class="nw-tags" type="text" placeholder="теги через запятую" />
      <div class="nw-tags-chips"></div>
      <details class="nw-props">
        <summary>Свойства</summary>
        <div class="nw-props-grid">
          <label>Слой <select class="nw-layer"></select></label>
          <label>Тип <select class="nw-type"></select></label>
          <label>Год начала <input class="nw-date-start" type="number" /></label>
          <label>Год окончания <input class="nw-date-end" type="number" /></label>
          <label>Широта <input class="nw-lat" type="number" step="0.01" /></label>
          <label>Долгота <input class="nw-lng" type="number" step="0.01" /></label>
        </div>
      </details>
      <textarea class="nw-content" placeholder="Текст заметки в markdown. Ссылка на другую заметку — [[Название]]"></textarea>
      <div class="nw-wiki-suggest hidden"></div>
      <div class="nw-links">
        <div class="nw-links-title">Связи</div>
        <div class="nw-links-list"></div>
      </div>
    </div>
    <div class="note-window-resize-handle"></div>
  `;

  document.body.appendChild(el);

  const refs = {
    titleBarLabel: el.querySelector('.note-window-title-label'),
    title: el.querySelector('.nw-title'),
    tags: el.querySelector('.nw-tags'),
    tagsChips: el.querySelector('.nw-tags-chips'),
    layer: el.querySelector('.nw-layer'),
    type: el.querySelector('.nw-type'),
    dateStart: el.querySelector('.nw-date-start'),
    dateEnd: el.querySelector('.nw-date-end'),
    lat: el.querySelector('.nw-lat'),
    lng: el.querySelector('.nw-lng'),
    content: el.querySelector('.nw-content'),
    wikiSuggest: el.querySelector('.nw-wiki-suggest'),
    linksList: el.querySelector('.nw-links-list'),
    minimizeBtn: el.querySelector('.nw-minimize'),
    closeBtn: el.querySelector('.nw-close'),
    resizeHandle: el.querySelector('.note-window-resize-handle'),
    titlebar: el.querySelector('.note-window-titlebar')
  };

  for (const [value, label] of Object.entries(TYPE_LABELS)) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    refs.type.appendChild(opt);
  }

  const win = { noteId: note.id, el, refs, minimized: false, dockBtn: null };

  wireWindowEvents(win);
  makeDraggable(win);
  makeResizable(win);
  syncWindowChrome(win, note);

  el.addEventListener('pointerdown', () => {
    focusWindow(win.noteId);
    const current = getNote(win.noteId);
    if (current) setSelection({ noteId: win.noteId, layerId: current.layerId });
  });

  return win;
}

function wireWindowEvents(win) {
  const { refs, noteId } = win;

  refs.minimizeBtn.addEventListener('click', () => minimizeWindow(noteId));
  refs.closeBtn.addEventListener('click', () => closeWindow(noteId));

  refs.titlebar.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, [
      { label: 'Свернуть', onClick: () => minimizeWindow(noteId) },
      { label: 'Закрыть окно', onClick: () => closeWindow(noteId) },
      {
        label: 'Удалить заметку',
        danger: true,
        onClick: () => {
          if (!window.confirm('Удалить заметку без возможности восстановления?')) return;
          deleteNote(noteId);
          closeWindow(noteId);
        }
      }
    ]);
  });

  const commitTitle = debounce((value) => updateNote(noteId, { title: value.trim() || 'Без названия' }), 250);
  refs.title.addEventListener('input', () => {
    refs.titleBarLabel.textContent = refs.title.value || 'Без названия';
    commitTitle(refs.title.value);
  });

  const commitTags = debounce((value) => updateNote(noteId, { tags: parseTagsInput(value) }), 300);
  refs.tags.addEventListener('input', () => {
    renderChips(win, parseTagsInput(refs.tags.value));
    commitTags(refs.tags.value);
  });

  refs.layer.addEventListener('change', () => updateNote(noteId, { layerId: refs.layer.value }));
  refs.type.addEventListener('change', () => updateNote(noteId, { type: refs.type.value }));

  const commitDateStart = debounce((value) => updateNote(noteId, { dateStart: value === '' ? null : Number(value) }), 300);
  refs.dateStart.addEventListener('input', () => commitDateStart(refs.dateStart.value));

  const commitDateEnd = debounce((value) => updateNote(noteId, { dateEnd: value === '' ? null : Number(value) }), 300);
  refs.dateEnd.addEventListener('input', () => commitDateEnd(refs.dateEnd.value));

  const commitGeo = debounce(() => {
    const lat = refs.lat.value;
    const lng = refs.lng.value;
    updateNote(noteId, { geo: (lat !== '' && lng !== '') ? { lat: Number(lat), lng: Number(lng) } : null });
  }, 300);
  refs.lat.addEventListener('input', commitGeo);
  refs.lng.addEventListener('input', commitGeo);

  const commitContent = debounce(() => {
    updateNote(noteId, { content: refs.content.value });
    syncLinksFromContent(noteId);
  }, 400);
  refs.content.addEventListener('input', () => {
    commitContent();
    handleWikiAutocomplete(win);
  });
  refs.content.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') refs.wikiSuggest.classList.add('hidden');
  });
  refs.content.addEventListener('blur', () => {
    setTimeout(() => refs.wikiSuggest.classList.add('hidden'), 150);
  });
}

function handleWikiAutocomplete(win) {
  const textarea = win.refs.content;
  const box = win.refs.wikiSuggest;
  const caret = textarea.selectionStart;
  const uptoCaret = textarea.value.slice(0, caret);
  const match = /\[\[([^\]]*)$/.exec(uptoCaret);
  if (!match) { box.classList.add('hidden'); return; }

  const query = match[1].toLowerCase();
  const candidates = store.data.notes
    .filter((n) => n.id !== win.noteId && n.title.toLowerCase().includes(query))
    .slice(0, 8);
  if (candidates.length === 0) { box.classList.add('hidden'); return; }

  box.innerHTML = '';
  for (const candidate of candidates) {
    const item = document.createElement('div');
    item.className = 'wiki-suggest-item';
    item.textContent = candidate.title;
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      insertWikiLink(win, candidate.title);
    });
    box.appendChild(item);
  }
  box.classList.remove('hidden');
}

function insertWikiLink(win, title) {
  const textarea = win.refs.content;
  const caret = textarea.selectionStart;
  const uptoCaret = textarea.value.slice(0, caret);
  const match = /\[\[([^\]]*)$/.exec(uptoCaret);
  if (!match) return;

  const prefix = textarea.value.slice(0, match.index) + '[[';
  const after = textarea.value.slice(caret);
  textarea.value = `${prefix}${title}]]${after}`;
  const newCaret = prefix.length + title.length + 2;
  textarea.setSelectionRange(newCaret, newCaret);
  textarea.focus();
  win.refs.wikiSuggest.classList.add('hidden');

  updateNote(win.noteId, { content: textarea.value });
  syncLinksFromContent(win.noteId);
}

function renderChips(win, tags) {
  const container = win.refs.tagsChips;
  container.innerHTML = '';
  for (const tag of tags) {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.textContent = tag;
    container.appendChild(chip);
  }
}

function populateLayerOptions(win, note) {
  const select = win.refs.layer;
  if (document.activeElement === select) return;
  const layers = [...store.data.layers].sort((a, b) => a.order - b.order);
  const freshIds = layers.map((l) => l.id).join(',');
  const currentIds = [...select.options].map((o) => o.value).join(',');
  if (currentIds !== freshIds) {
    select.innerHTML = '';
    for (const layer of layers) {
      const opt = document.createElement('option');
      opt.value = layer.id;
      opt.textContent = layer.name;
      select.appendChild(opt);
    }
  }
  select.value = note.layerId;
}

function renderResolvedLinks(win, note) {
  const list = win.refs.linksList;
  list.innerHTML = '';
  const resolved = resolveWikiLinks(note.content, store.data.notes, note.id);

  if (resolved.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'nw-links-hint';
    hint.textContent = 'Ссылки появятся здесь — печатайте [[Название заметки]] в тексте.';
    list.appendChild(hint);
    return;
  }

  for (const { title, note: target } of resolved) {
    const chip = document.createElement('button');
    chip.className = target ? 'link-chip resolved' : 'link-chip unresolved';
    chip.textContent = target ? target.title : `${title} (создать)`;
    chip.addEventListener('click', () => {
      if (target) {
        openNoteWindow(target.id);
      } else {
        const created = addNote({ title, layerId: note.layerId, type: 'event' });
        openNoteWindow(created.id);
      }
    });
    list.appendChild(chip);
  }
}

function syncWindowChrome(win, note) {
  const r = win.refs;
  setValueIfNotFocused(r.title, note.title);
  r.titleBarLabel.textContent = note.title || 'Без названия';
  setValueIfNotFocused(r.tags, (note.tags || []).join(', '));
  if (document.activeElement !== r.tags) renderChips(win, note.tags || []);
  populateLayerOptions(win, note);
  setValueIfNotFocused(r.type, note.type);
  setValueIfNotFocused(r.dateStart, typeof note.dateStart === 'number' ? note.dateStart : '');
  setValueIfNotFocused(r.dateEnd, typeof note.dateEnd === 'number' ? note.dateEnd : '');
  setValueIfNotFocused(r.lat, note.geo ? note.geo.lat : '');
  setValueIfNotFocused(r.lng, note.geo ? note.geo.lng : '');
  setValueIfNotFocused(r.content, note.content || '');
  renderResolvedLinks(win, note);
  win.el.classList.toggle('nw-selected', store.selection.noteId === note.id);
}

function makeDraggable(win) {
  const handle = win.refs.titlebar;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  handle.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = win.el.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    handle.setPointerCapture(e.pointerId);
  });

  handle.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    win.el.style.left = `${Math.max(0, startLeft + dx)}px`;
    win.el.style.top = `${Math.max(0, startTop + dy)}px`;
  });

  const stop = (e) => {
    dragging = false;
    try { handle.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  };
  handle.addEventListener('pointerup', stop);
  handle.addEventListener('pointercancel', stop);
}

function makeResizable(win) {
  const handle = win.refs.resizeHandle;
  let resizing = false;
  let startX = 0;
  let startY = 0;
  let startW = 0;
  let startH = 0;

  handle.addEventListener('pointerdown', (e) => {
    resizing = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = win.el.getBoundingClientRect();
    startW = rect.width;
    startH = rect.height;
    handle.setPointerCapture(e.pointerId);
    e.stopPropagation();
  });

  handle.addEventListener('pointermove', (e) => {
    if (!resizing) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    win.el.style.width = `${Math.max(360, startW + dx)}px`;
    win.el.style.height = `${Math.max(320, startH + dy)}px`;
  });

  const stop = (e) => {
    resizing = false;
    try { handle.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  };
  handle.addEventListener('pointerup', stop);
  handle.addEventListener('pointercancel', stop);
}
