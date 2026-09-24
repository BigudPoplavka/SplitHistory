import { store, init, subscribe, getNote, setSelection, setViewMode, deleteNote, saveVault, saveVaultAs, openVault } from './store.js';
import { initScene, syncScene } from './scene.js';
import { openNoteWindow, renderNoteWindows } from './ui/noteWindows.js';
import { initLayerModal } from './ui/layerModal.js';
import { initLayersPanel, renderLayersPanel } from './ui/layersPanel.js';
import { initTreePanel, renderTreePanel } from './ui/treePanel.js';
import { renderInfoPanel } from './ui/infoPanel.js';
import { initTimeline, renderTimeline } from './ui/timeline.js';
import { renderMiniGraph } from './ui/miniGraph.js';
import { initLayer2D, renderLayer2D } from './ui/layer2d.js';

let toastTimeout = null;

function showToast(message) {
  const toast = document.getElementById('status-toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.add('hidden'), 2500);
}

function syncViewMode() {
  const is3d = store.viewMode === '3d';
  document.getElementById('scene-container').classList.toggle('hidden', !is3d);
  document.getElementById('layer-2d-container').classList.toggle('hidden', is3d);
  document.getElementById('mini-graph-panel').classList.toggle('hidden', !is3d);
  for (const btn of document.querySelectorAll('#view-mode-toggle button')) {
    btn.classList.toggle('active', btn.dataset.mode === store.viewMode);
  }
}

function renderAll() {
  syncViewMode();
  if (store.viewMode === '3d') {
    syncScene();
    renderMiniGraph();
  } else {
    renderLayer2D();
  }
  renderTreePanel();
  renderLayersPanel();
  renderInfoPanel();
  renderTimeline();
  renderNoteWindows();
}

async function doSave() {
  try {
    const filePath = await saveVault();
    showToast(`Сохранено: ${filePath}`);
  } catch (err) {
    showToast(`Ошибка сохранения: ${err.message}`);
  }
}

async function doSaveAs() {
  try {
    const filePath = await saveVaultAs();
    if (filePath) showToast(`Сохранено как: ${filePath}`);
  } catch (err) {
    showToast(`Ошибка сохранения: ${err.message}`);
  }
}

async function doOpen() {
  try {
    const opened = await openVault();
    if (opened) showToast('Хранилище открыто');
  } catch (err) {
    showToast(`Ошибка открытия: ${err.message}`);
  }
}

async function bootstrap() {
  await init();

  initScene(document.getElementById('scene-container'), {
    onSelectNote: (noteId) => setSelection({ noteId, layerId: getNote(noteId)?.layerId ?? store.selection.layerId }),
    onSelectLayer: (layerId) => setSelection({ layerId, noteId: null }),
    onEditNote: (noteId) => openNoteWindow(noteId)
  });

  initLayer2D(document.getElementById('layer-2d-canvas'), {
    onEditNote: (noteId) => openNoteWindow(noteId)
  });

  initLayerModal();
  initLayersPanel();
  initTreePanel();
  initTimeline();

  for (const btn of document.querySelectorAll('#view-mode-toggle button')) {
    btn.addEventListener('click', () => setViewMode(btn.dataset.mode));
  }

  window.addEventListener('resize', () => {
    if (store.viewMode === '2d') renderLayer2D();
  });

  subscribe(renderAll);
  renderAll();

  window.vaultAPI.onMenuSave(doSave);
  window.vaultAPI.onMenuSaveAs(doSaveAs);
  window.vaultAPI.onMenuOpen(doOpen);

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (e.shiftKey) doSaveAs();
      else doSave();
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && store.selection.noteId && !isEditableTarget(e.target)) {
      e.preventDefault();
      const note = getNote(store.selection.noteId);
      if (note && window.confirm(`Удалить заметку «${note.title}» без возможности восстановления?`)) {
        deleteNote(note.id);
      }
    }
  });
}

function isEditableTarget(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

bootstrap();
