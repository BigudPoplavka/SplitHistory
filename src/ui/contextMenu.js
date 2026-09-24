let currentMenu = null;

function closeMenu() {
  if (currentMenu) {
    currentMenu.remove();
    currentMenu = null;
  }
  document.removeEventListener('pointerdown', onOutsidePointerDown, true);
  document.removeEventListener('keydown', onKeyDown, true);
}

function onOutsidePointerDown(e) {
  if (currentMenu && !currentMenu.contains(e.target)) closeMenu();
}

function onKeyDown(e) {
  if (e.key === 'Escape') closeMenu();
}

/** items: [{ label, danger?, onClick }] */
export function showContextMenu(x, y, items) {
  closeMenu();

  const menu = document.createElement('div');
  menu.className = 'context-menu';

  for (const item of items) {
    const btn = document.createElement('button');
    btn.className = 'context-menu-item' + (item.danger ? ' danger' : '');
    btn.textContent = item.label;
    btn.addEventListener('click', () => {
      closeMenu();
      item.onClick();
    });
    menu.appendChild(btn);
  }

  document.body.appendChild(menu);

  const rect = menu.getBoundingClientRect();
  const left = Math.min(x, window.innerWidth - rect.width - 8);
  const top = Math.min(y, window.innerHeight - rect.height - 8);
  menu.style.left = `${Math.max(4, left)}px`;
  menu.style.top = `${Math.max(4, top)}px`;

  currentMenu = menu;
  setTimeout(() => {
    document.addEventListener('pointerdown', onOutsidePointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
  }, 0);
}
