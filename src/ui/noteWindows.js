import {
  store, getNote, updateNote, deleteNote, addNote, syncLinksFromContent, setSelection,
  restoreNoteVersion, addAttachment, removeAttachment
} from '../store.js';
import { TYPE_LABELS, parseTagsInput, resolveWikiLinks, extractHeadings, renderMarkdownToHtml } from '../utils.js';
import { findSimilarNotes } from '../similarity.js';
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

function toFileUrl(rawPath) {
  return `file:///${encodeURI(rawPath.replace(/\\/g, '/'))}`;
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

export function createNoteWindow(layerId, templatePartial) {
  const fallbackLayer = layerId
    || store.data.layers.find((l) => l.kind !== 'map')?.id
    || store.data.layers[0]?.id;
  const note = addNote({ title: 'Новая заметка', layerId: fallbackLayer, type: 'event', ...templatePartial });
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
  el.style.width = '560px';
  el.style.height = '620px';

  el.innerHTML = `
    <div class="note-window-titlebar">
      <span class="note-window-title-label"></span>
      <div class="note-window-actions">
        <button class="nw-btn nw-outline-toggle" type="button" title="Содержание">📑</button>
        <button class="nw-btn nw-minimize" type="button" title="Свернуть">–</button>
        <button class="nw-btn nw-close" type="button" title="Закрыть">×</button>
      </div>
    </div>
    <div class="note-window-body">
      <div class="nw-main">
        <input class="nw-title" type="text" placeholder="Название заметки" />
        <div class="nw-duplicate-warning hidden"></div>

        <div class="nw-photo hidden">
          <img class="nw-photo-img hidden" />
          <div class="nw-photo-actions">
            <button class="nw-photo-set btn-secondary" type="button">Добавить фото</button>
            <button class="nw-photo-clear btn-icon hidden" type="button" title="Убрать фото">×</button>
          </div>
        </div>

        <input class="nw-tags" type="text" placeholder="теги через запятую" />
        <div class="nw-tags-chips"></div>

        <details class="nw-props">
          <summary>Свойства</summary>
          <div class="nw-props-grid">
            <label>Слой <select class="nw-layer"></select></label>
            <label>Тип <select class="nw-type"></select></label>
            <label>Год начала <input class="nw-date-start" type="number" /></label>
            <label>Год окончания <input class="nw-date-end" type="number" /></label>
          </div>
          <label class="nw-checkbox-row"><input class="nw-date-approx" type="checkbox" /> Приблизительная дата (ок.)</label>
          <label>Период / эпоха <input class="nw-period-label" type="text" placeholder="например, Ренессанс" /></label>

          <label>Геопривязка
            <select class="nw-geo-kind">
              <option value="none">нет</option>
              <option value="point">точка</option>
              <option value="route">маршрут</option>
              <option value="region">регион</option>
            </select>
          </label>
          <div class="nw-props-grid nw-geo-point">
            <label>Широта <input class="nw-lat" type="number" step="0.01" /></label>
            <label>Долгота <input class="nw-lng" type="number" step="0.01" /></label>
          </div>
          <label class="nw-geo-list hidden">
            <span class="nw-geo-list-label"></span>
            <textarea class="nw-geo-points" rows="3" placeholder="широта, долгота — по одной паре на строке"></textarea>
          </label>
        </details>

        <details class="nw-citation hidden">
          <summary>Цитирование источника</summary>
          <div class="nw-props-grid">
            <label>Автор <input class="nw-cite-author" type="text" /></label>
            <label>Год публикации <input class="nw-cite-year" type="number" /></label>
            <label>Издание / публикатор <input class="nw-cite-publisher" type="text" /></label>
            <label>URL <input class="nw-cite-url" type="text" /></label>
            <label>Надёжность
              <select class="nw-cite-reliability">
                <option value="1">1 — сомнительно</option>
                <option value="2">2 — слабо подтверждено</option>
                <option value="3">3 — умеренно надёжно</option>
                <option value="4">4 — надёжно</option>
                <option value="5">5 — подтверждено независимо</option>
              </select>
            </label>
          </div>
        </details>

        <div class="nw-content-header">
          <div class="nw-mode-toggle view-toggle">
            <button class="nw-mode-btn active" type="button" data-mode="edit">Редактировать</button>
            <button class="nw-mode-btn" type="button" data-mode="preview">Просмотр</button>
          </div>
        </div>
        <textarea class="nw-content" placeholder="Текст заметки в markdown. Ссылка на другую заметку — [[Название]]"></textarea>
        <div class="nw-preview hidden"></div>
        <div class="nw-wiki-suggest hidden"></div>

        <div class="nw-links">
          <div class="nw-links-title">Связи</div>
          <div class="nw-links-list"></div>
        </div>

        <details class="nw-attachments">
          <summary>Вложения</summary>
          <div class="nw-attachments-list"></div>
          <button class="nw-attach-add btn-secondary" type="button">+ Файл</button>
        </details>

        <details class="nw-history">
          <summary>История изменений</summary>
          <div class="nw-history-list"></div>
        </details>
      </div>

      <div class="nw-outline hidden">
        <div class="nw-outline-title">Содержание</div>
        <div class="nw-outline-list"></div>
      </div>
    </div>
    <div class="note-window-resize-handle"></div>
  `;

  document.body.appendChild(el);

  const refs = {
    titleBarLabel: el.querySelector('.note-window-title-label'),
    title: el.querySelector('.nw-title'),
    duplicateWarning: el.querySelector('.nw-duplicate-warning'),
    photoBox: el.querySelector('.nw-photo'),
    photoImg: el.querySelector('.nw-photo-img'),
    photoSetBtn: el.querySelector('.nw-photo-set'),
    photoClearBtn: el.querySelector('.nw-photo-clear'),
    tags: el.querySelector('.nw-tags'),
    tagsChips: el.querySelector('.nw-tags-chips'),
    layer: el.querySelector('.nw-layer'),
    type: el.querySelector('.nw-type'),
    dateStart: el.querySelector('.nw-date-start'),
    dateEnd: el.querySelector('.nw-date-end'),
    dateApprox: el.querySelector('.nw-date-approx'),
    periodLabel: el.querySelector('.nw-period-label'),
    geoKind: el.querySelector('.nw-geo-kind'),
    geoPoint: el.querySelector('.nw-geo-point'),
    lat: el.querySelector('.nw-lat'),
    lng: el.querySelector('.nw-lng'),
    geoList: el.querySelector('.nw-geo-list'),
    geoListLabel: el.querySelector('.nw-geo-list-label'),
    geoPoints: el.querySelector('.nw-geo-points'),
    citation: el.querySelector('.nw-citation'),
    citeAuthor: el.querySelector('.nw-cite-author'),
    citeYear: el.querySelector('.nw-cite-year'),
    citePublisher: el.querySelector('.nw-cite-publisher'),
    citeUrl: el.querySelector('.nw-cite-url'),
    citeReliability: el.querySelector('.nw-cite-reliability'),
    modeButtons: [...el.querySelectorAll('.nw-mode-btn')],
    content: el.querySelector('.nw-content'),
    preview: el.querySelector('.nw-preview'),
    wikiSuggest: el.querySelector('.nw-wiki-suggest'),
    linksList: el.querySelector('.nw-links-list'),
    attachmentsList: el.querySelector('.nw-attachments-list'),
    attachAddBtn: el.querySelector('.nw-attach-add'),
    historyList: el.querySelector('.nw-history-list'),
    outline: el.querySelector('.nw-outline'),
    outlineList: el.querySelector('.nw-outline-list'),
    outlineToggleBtn: el.querySelector('.nw-outline-toggle'),
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

  const win = { noteId: note.id, el, refs, minimized: false, dockBtn: null, mode: 'edit', outlineVisible: false };

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

  refs.outlineToggleBtn.addEventListener('click', () => {
    win.outlineVisible = !win.outlineVisible;
    refs.outline.classList.toggle('hidden', !win.outlineVisible);
    refs.outlineToggleBtn.classList.toggle('active', win.outlineVisible);
  });

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
    renderDuplicateWarning(win);
  });

  refs.photoSetBtn.addEventListener('click', async () => {
    if (!window.vaultAPI.photoSet) return;
    const result = await window.vaultAPI.photoSet(noteId);
    if (result) updateNote(noteId, { photo: result });
  });
  refs.photoClearBtn.addEventListener('click', () => updateNote(noteId, { photo: null }));

  const commitTags = debounce((value) => updateNote(noteId, { tags: parseTagsInput(value) }), 300);
  refs.tags.addEventListener('input', () => {
    renderChips(win, parseTagsInput(refs.tags.value));
    commitTags(refs.tags.value);
  });

  refs.layer.addEventListener('change', () => updateNote(noteId, { layerId: refs.layer.value }));
  refs.type.addEventListener('change', () => {
    updateNote(noteId, { type: refs.type.value });
    renderDuplicateWarning(win);
  });

  const commitDateStart = debounce((value) => updateNote(noteId, { dateStart: value === '' ? null : Number(value) }), 300);
  refs.dateStart.addEventListener('input', () => commitDateStart(refs.dateStart.value));

  const commitDateEnd = debounce((value) => updateNote(noteId, { dateEnd: value === '' ? null : Number(value) }), 300);
  refs.dateEnd.addEventListener('input', () => commitDateEnd(refs.dateEnd.value));

  refs.dateApprox.addEventListener('change', () => updateNote(noteId, { dateApprox: refs.dateApprox.checked }));

  const commitPeriodLabel = debounce((value) => updateNote(noteId, { periodLabel: value }), 300);
  refs.periodLabel.addEventListener('input', () => commitPeriodLabel(refs.periodLabel.value));

  const commitGeoPoint = debounce(() => {
    const lat = refs.lat.value;
    const lng = refs.lng.value;
    updateNote(noteId, { geo: (lat !== '' && lng !== '') ? { lat: Number(lat), lng: Number(lng) } : null });
  }, 300);
  refs.lat.addEventListener('input', commitGeoPoint);
  refs.lng.addEventListener('input', commitGeoPoint);

  refs.geoKind.addEventListener('change', () => {
    const kind = refs.geoKind.value;
    if (kind === 'none') updateNote(noteId, { geo: null, route: null, region: null });
    else if (kind === 'point') updateNote(noteId, { route: null, region: null });
    else if (kind === 'route') updateNote(noteId, { geo: null, region: null, route: getNote(noteId).route || [] });
    else if (kind === 'region') updateNote(noteId, { geo: null, route: null, region: getNote(noteId).region || [] });
    syncGeoEditor(win, getNote(noteId));
  });

  const commitGeoPoints = debounce(() => commitGeoPointsList(win), 400);
  refs.geoPoints.addEventListener('input', commitGeoPoints);

  const commitCitation = debounce(() => {
    updateNote(noteId, {
      citation: {
        author: refs.citeAuthor.value,
        publicationYear: refs.citeYear.value === '' ? null : Number(refs.citeYear.value),
        publisher: refs.citePublisher.value,
        url: refs.citeUrl.value,
        reliability: Number(refs.citeReliability.value)
      }
    });
  }, 300);
  for (const el of [refs.citeAuthor, refs.citeYear, refs.citePublisher, refs.citeUrl]) {
    el.addEventListener('input', commitCitation);
  }
  refs.citeReliability.addEventListener('change', commitCitation);

  for (const btn of refs.modeButtons) {
    btn.addEventListener('click', () => {
      if (btn.dataset.mode === 'preview' && win.mode !== 'preview') {
        updateNote(noteId, { content: refs.content.value });
        syncLinksFromContent(noteId);
      }
      win.mode = btn.dataset.mode;
      applyModeVisibility(win, getNote(noteId));
    });
  }

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

  refs.preview.addEventListener('click', (e) => {
    const wikiLink = e.target.closest('.md-wikilink');
    if (wikiLink) {
      if (wikiLink.classList.contains('resolved')) {
        openNoteWindow(wikiLink.dataset.noteId);
      } else {
        const title = wikiLink.dataset.title || wikiLink.textContent;
        const current = getNote(noteId);
        const created = addNote({ title, layerId: current ? current.layerId : undefined, type: 'event' });
        openNoteWindow(created.id);
      }
      return;
    }
    const link = e.target.closest('.md-link');
    if (link) window.vaultAPI.openExternalLink?.(link.dataset.href);
  });

  refs.attachAddBtn.addEventListener('click', async () => {
    if (!window.vaultAPI.attachmentAdd) return;
    const result = await window.vaultAPI.attachmentAdd(noteId);
    if (result) addAttachment(noteId, result);
  });
}

function commitGeoPointsList(win) {
  const kind = win.refs.geoKind.value;
  if (kind !== 'route' && kind !== 'region') return;
  const lines = win.refs.geoPoints.value.split('\n').map((l) => l.trim()).filter(Boolean);
  const points = [];
  for (const line of lines) {
    const parts = line.split(',').map((p) => Number(p.trim()));
    if (parts.length === 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
      points.push({ lat: parts[0], lng: parts[1] });
    }
  }
  if (kind === 'route') {
    updateNote(win.noteId, { route: points.length ? points : null, region: null, geo: null });
  } else {
    updateNote(win.noteId, { region: points.length ? points.map((p) => [p.lat, p.lng]) : null, route: null, geo: null });
  }
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

function renderDuplicateWarning(win) {
  const box = win.refs.duplicateWarning;
  const title = win.refs.title.value.trim();
  const type = win.refs.type.value;
  if (!title) { box.classList.add('hidden'); return; }

  const similar = findSimilarNotes(title, type, store.data.notes, win.noteId);
  if (similar.length === 0) { box.classList.add('hidden'); return; }

  box.innerHTML = '';
  const label = document.createElement('span');
  label.textContent = 'Похожая заметка уже есть: ';
  box.appendChild(label);
  similar.slice(0, 3).forEach((r, i) => {
    if (i > 0) box.appendChild(document.createTextNode(', '));
    const link = document.createElement('button');
    link.className = 'nw-duplicate-link';
    link.textContent = r.note.title;
    link.addEventListener('click', () => openNoteWindow(r.note.id));
    box.appendChild(link);
  });
  box.classList.remove('hidden');
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

function syncGeoEditor(win, note) {
  const r = win.refs;
  const kind = note.route ? 'route' : note.region ? 'region' : note.geo ? 'point' : 'none';
  if (document.activeElement !== r.geoKind) r.geoKind.value = kind;

  r.geoPoint.classList.toggle('hidden', kind !== 'point');
  r.geoList.classList.toggle('hidden', kind !== 'route' && kind !== 'region');

  if (kind === 'point') {
    setValueIfNotFocused(r.lat, note.geo ? note.geo.lat : '');
    setValueIfNotFocused(r.lng, note.geo ? note.geo.lng : '');
  } else if ((kind === 'route' || kind === 'region') && document.activeElement !== r.geoPoints) {
    r.geoListLabel.textContent = kind === 'route'
      ? 'Точки маршрута (широта, долгота — по одной паре на строке)'
      : 'Контур региона (широта, долгота — по одной паре на строке)';
    const points = kind === 'route'
      ? (note.route || []).map((p) => `${p.lat}, ${p.lng}`)
      : (note.region || []).map(([lat, lng]) => `${lat}, ${lng}`);
    r.geoPoints.value = points.join('\n');
  }
}

function renderPhoto(win, note) {
  const r = win.refs;
  const isPerson = note.type === 'person';
  r.photoBox.classList.toggle('hidden', !isPerson);
  if (!isPerson) return;

  if (note.photo) {
    r.photoImg.src = toFileUrl(note.photo.path);
    r.photoImg.classList.remove('hidden');
    r.photoSetBtn.textContent = 'Заменить фото';
    r.photoClearBtn.classList.remove('hidden');
  } else {
    r.photoImg.classList.add('hidden');
    r.photoImg.removeAttribute('src');
    r.photoSetBtn.textContent = 'Добавить фото';
    r.photoClearBtn.classList.add('hidden');
  }
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

function renderAttachments(win, note) {
  const list = win.refs.attachmentsList;
  list.innerHTML = '';
  if (note.attachments.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'nw-links-hint';
    hint.textContent = 'Нет вложений.';
    list.appendChild(hint);
    return;
  }
  for (const att of note.attachments) {
    const row = document.createElement('div');
    row.className = 'nw-attachment-row';

    const nameBtn = document.createElement('button');
    nameBtn.className = 'nw-attachment-name';
    nameBtn.textContent = att.fileName;
    nameBtn.title = 'Открыть файл';
    nameBtn.addEventListener('click', () => window.vaultAPI.attachmentOpen?.(att.path));

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-icon';
    removeBtn.textContent = '×';
    removeBtn.title = 'Открепить';
    removeBtn.addEventListener('click', () => removeAttachment(note.id, att.id));

    row.append(nameBtn, removeBtn);
    list.appendChild(row);
  }
}

function renderHistory(win, note) {
  const list = win.refs.historyList;
  list.innerHTML = '';
  if (note.history.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'nw-links-hint';
    hint.textContent = 'Пока нет сохранённых версий.';
    list.appendChild(hint);
    return;
  }
  [...note.history].reverse().forEach((version) => {
    const index = note.history.indexOf(version);
    const row = document.createElement('div');
    row.className = 'nw-history-row';

    const label = document.createElement('span');
    const date = new Date(version.timestamp);
    label.textContent = `${date.toLocaleDateString()} ${date.toLocaleTimeString()} — «${version.title}»`;

    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'btn-icon';
    restoreBtn.textContent = '↺';
    restoreBtn.title = 'Восстановить эту версию';
    restoreBtn.addEventListener('click', () => {
      if (window.confirm('Восстановить эту версию заметки? Текущая версия тоже будет сохранена в историю.')) {
        restoreNoteVersion(note.id, index);
      }
    });

    row.append(label, restoreBtn);
    list.appendChild(row);
  });
}

function renderOutline(win, note) {
  const list = win.refs.outlineList;
  list.innerHTML = '';
  const headings = extractHeadings(note.content);
  if (headings.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'nw-links-hint';
    hint.textContent = 'В тексте нет заголовков (#, ##, ...).';
    list.appendChild(hint);
    return;
  }
  headings.forEach((h, i) => {
    const item = document.createElement('button');
    item.className = `nw-outline-item md-h${h.level}`;
    item.style.paddingLeft = `${(h.level - 1) * 10 + 8}px`;
    item.textContent = h.text;
    item.addEventListener('click', () => {
      win.mode = 'preview';
      applyModeVisibility(win, getNote(win.noteId));
      requestAnimationFrame(() => {
        win.refs.preview.querySelector(`#md-h-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    list.appendChild(item);
  });
}

function applyModeVisibility(win, note) {
  const isPreview = win.mode === 'preview';
  win.refs.content.classList.toggle('hidden', isPreview);
  win.refs.preview.classList.toggle('hidden', !isPreview);
  if (isPreview) win.refs.wikiSuggest.classList.add('hidden');
  for (const btn of win.refs.modeButtons) btn.classList.toggle('active', btn.dataset.mode === win.mode);
  if (isPreview && note) {
    win.refs.preview.innerHTML = renderMarkdownToHtml(note.content, store.data.notes, note.id);
  }
}

function syncWindowChrome(win, note) {
  const r = win.refs;
  setValueIfNotFocused(r.title, note.title);
  r.titleBarLabel.textContent = note.title || 'Без названия';
  setValueIfNotFocused(r.tags, (note.tags || []).join(', '));
  if (document.activeElement !== r.tags) renderChips(win, note.tags || []);
  renderPhoto(win, note);
  populateLayerOptions(win, note);
  setValueIfNotFocused(r.type, note.type);
  setValueIfNotFocused(r.dateStart, typeof note.dateStart === 'number' ? note.dateStart : '');
  setValueIfNotFocused(r.dateEnd, typeof note.dateEnd === 'number' ? note.dateEnd : '');
  if (document.activeElement !== r.dateApprox) r.dateApprox.checked = !!note.dateApprox;
  setValueIfNotFocused(r.periodLabel, note.periodLabel || '');

  syncGeoEditor(win, note);

  r.citation.classList.toggle('hidden', note.type !== 'source');
  if (note.type === 'source') {
    const c = note.citation || {};
    setValueIfNotFocused(r.citeAuthor, c.author || '');
    setValueIfNotFocused(r.citeYear, typeof c.publicationYear === 'number' ? c.publicationYear : '');
    setValueIfNotFocused(r.citePublisher, c.publisher || '');
    setValueIfNotFocused(r.citeUrl, c.url || '');
    if (document.activeElement !== r.citeReliability) r.citeReliability.value = String(c.reliability || 3);
  }

  setValueIfNotFocused(r.content, note.content || '');
  applyModeVisibility(win, note);
  renderResolvedLinks(win, note);
  renderAttachments(win, note);
  renderHistory(win, note);
  renderOutline(win, note);
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
    win.el.style.width = `${Math.max(380, startW + dx)}px`;
    win.el.style.height = `${Math.max(320, startH + dy)}px`;
  });

  const stop = (e) => {
    resizing = false;
    try { handle.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  };
  handle.addEventListener('pointerup', stop);
  handle.addEventListener('pointercancel', stop);
}
