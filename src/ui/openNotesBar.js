import { store, getNote } from '../store.js';
import { buildNoteGroups } from '../grouping.js';

let currentGroups = [];
let activeGroupIndex = -1;
let activeNoteIndex = 0;
let closeTimer = null;

/** Ленивая ссылка на noteWindows.js — избегаем закольцованного импорта на этапе загрузки модулей. */
let noteWindowsApi = null;
export function connectNoteWindowsApi(api) {
  noteWindowsApi = api;
}

export function initOpenNotesBar() {
  const bar = document.getElementById('open-notes-bar');
  const flyout = document.getElementById('open-notes-flyout');

  bar.addEventListener('mouseleave', scheduleClose);
  flyout.addEventListener('mouseenter', cancelClose);
  flyout.addEventListener('mouseleave', scheduleClose);

  document.addEventListener('pointerdown', (e) => {
    if (!bar.contains(e.target) && !flyout.contains(e.target)) closeFlyout();
  });

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  // Если фокус ушёл из приложения, пока Alt был зажат (например, реальный Alt+Tab), keyup
  // может не долететь — на всякий случай закрываем флайаут и там.
  window.addEventListener('blur', closeFlyout);
}

function scheduleClose() {
  cancelClose();
  closeTimer = setTimeout(closeFlyout, 300);
}

function cancelClose() {
  clearTimeout(closeTimer);
  closeTimer = null;
}

export function renderOpenNotesBar() {
  const bar = document.getElementById('open-notes-bar');
  if (!bar || !noteWindowsApi) return;
  bar.innerHTML = '';

  const openIds = new Set(noteWindowsApi.getOpenNoteIds());
  if (openIds.size === 0) {
    currentGroups = [];
    closeFlyout();
    return;
  }

  const allGroups = buildNoteGroups(store.data.notes, store.data.layers, store.groupBy);
  currentGroups = allGroups
    .map((g) => ({ ...g, notes: g.notes.filter((n) => openIds.has(n.id)) }))
    .filter((g) => g.notes.length > 0);

  currentGroups.forEach((group, index) => {
    const btn = document.createElement('button');
    btn.className = 'open-notes-group-btn' + (index === activeGroupIndex ? ' active' : '');
    btn.title = group.label;

    const badge = group.icon
      ? Object.assign(document.createElement('span'), { className: 'open-notes-group-icon', textContent: group.icon })
      : Object.assign(document.createElement('span'), { className: 'open-notes-group-dot' });
    if (!group.icon) badge.style.background = group.color;

    const count = document.createElement('span');
    count.className = 'open-notes-group-count';
    count.textContent = String(group.notes.length);

    btn.append(badge, count);
    btn.addEventListener('mouseenter', () => { cancelClose(); showFlyout(index, 0); });
    btn.addEventListener('click', () => { cancelClose(); showFlyout(index, 0); });

    bar.appendChild(btn);
  });

  if (activeGroupIndex >= 0 && activeGroupIndex < currentGroups.length) {
    showFlyout(activeGroupIndex, Math.min(activeNoteIndex, currentGroups[activeGroupIndex].notes.length - 1));
  } else if (activeGroupIndex !== -1) {
    closeFlyout();
  }
}

function showFlyout(groupIndex, noteIndex) {
  const group = currentGroups[groupIndex];
  if (!group) { closeFlyout(); return; }
  activeGroupIndex = groupIndex;
  activeNoteIndex = Math.max(0, Math.min(noteIndex, group.notes.length - 1));

  for (const btn of document.querySelectorAll('.open-notes-group-btn')) btn.classList.remove('active');
  const barButtons = document.querySelectorAll('.open-notes-group-btn');
  barButtons[groupIndex]?.classList.add('active');

  const flyout = document.getElementById('open-notes-flyout');
  flyout.innerHTML = '';
  flyout.classList.remove('hidden');
  flyout.style.top = `${barButtons[groupIndex]?.getBoundingClientRect().top ?? 0}px`;

  const list = document.createElement('div');
  list.className = 'open-notes-flyout-list';
  group.notes.forEach((note, i) => {
    const item = document.createElement('button');
    item.className = 'open-notes-flyout-item' + (i === activeNoteIndex ? ' active' : '');
    item.textContent = note.title || 'Без названия';
    item.addEventListener('click', () => {
      noteWindowsApi.openNoteWindow(note.id);
      closeFlyout();
    });
    list.appendChild(item);
  });

  const label = document.createElement('div');
  label.className = 'open-notes-flyout-label';
  label.textContent = group.label;

  flyout.append(list, label);
}

function closeFlyout() {
  activeGroupIndex = -1;
  for (const btn of document.querySelectorAll('.open-notes-group-btn')) btn.classList.remove('active');
  const flyout = document.getElementById('open-notes-flyout');
  if (flyout) {
    flyout.classList.add('hidden');
    flyout.innerHTML = '';
  }
}

/** Открывает окно заметки, выбранной клавиатурой в текущей группе, и закрывает флайаут. */
function activateSelection() {
  const note = currentGroups[activeGroupIndex]?.notes[activeNoteIndex];
  if (note && getNote(note.id) && noteWindowsApi) {
    noteWindowsApi.openNoteWindow(note.id);
  }
  closeFlyout();
}

function onKeyDown(e) {
  if (!e.altKey || currentGroups.length === 0) return;

  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (activeGroupIndex === -1) { showFlyout(0, 0); return; }
    const dir = e.key === 'ArrowDown' ? 1 : -1;
    showFlyout((activeGroupIndex + dir + currentGroups.length) % currentGroups.length, 0);
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    if (activeGroupIndex === -1) return;
    e.preventDefault();
    const group = currentGroups[activeGroupIndex];
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    showFlyout(activeGroupIndex, (activeNoteIndex + dir + group.notes.length) % group.notes.length);
  } else if (e.key === 'Enter' && activeGroupIndex !== -1) {
    e.preventDefault();
    activateSelection();
  } else if (e.key === 'Escape') {
    closeFlyout();
  }
}

/** Отпустили Alt после навигации стрелками — как в Alt+Tab, выбранная заметка становится активной. */
function onKeyUp(e) {
  if (e.key !== 'Alt' || activeGroupIndex === -1) return;
  activateSelection();
}
