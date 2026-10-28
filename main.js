const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const workspace = require('./workspace.cjs');
let projectRoot = null;
function rememberProject() { fs.writeFileSync(path.join(app.getPath('userData'), 'workspace.json'), JSON.stringify({projectRoot})); }
async function activateProject(root) {
  const data = await workspace.open(root);
  workspace.save(root,data);
  projectRoot = root; currentVaultPath = path.join(root,workspace.INDEX); rememberProject();
  mainWindow.setTitle(`SplitHistory — ${path.basename(root)}`);
  return {filePath:currentVaultPath,data};
}

const SAMPLE_VAULT_PATH = path.join(__dirname, 'data', 'vault.sample.json');

/** Путь к файлу хранилища пользователя (переживает переустановку кода приложения). */
function getDefaultVaultPath() {
  return path.join(app.getPath('userData'), 'vault.json');
}

/** При первом запуске копируем демо-хранилище, чтобы приложение не открывалось пустым. */
function ensureVaultExists(vaultPath) {
  if (!fs.existsSync(vaultPath)) {
    fs.mkdirSync(path.dirname(vaultPath), { recursive: true });
    fs.copyFileSync(SAMPLE_VAULT_PATH, vaultPath);
  }
}

let mainWindow;
let currentVaultPath;

function readVault(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

function writeVault(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#26282c',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  let allowClose = false;
  mainWindow.on('close', (event) => {
    if (!allowClose && !mainWindow.webContents.isLoading()) { event.preventDefault(); mainWindow.webContents.send('menu:flush-close'); }
  });
  ipcMain.removeAllListeners('vault:close-ready');
  ipcMain.on('vault:close-ready', () => {allowClose = true; mainWindow.close();});
  mainWindow.loadFile('index.html');

  const menu = Menu.buildFromTemplate(buildMenuTemplate());
  Menu.setApplicationMenu(menu);
}

function buildMenuTemplate() {
  const isMac = process.platform === 'darwin';
  return [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'Файл',
      submenu: [
        {label:'Новый проект…', accelerator:'CmdOrCtrl+N', click:() => mainWindow.webContents.send('menu:project','new')},
        {label:'Открыть папку как рабочее пространство…', accelerator:'CmdOrCtrl+Shift+O', click:() => mainWindow.webContents.send('menu:project','open')},
        {label:'Импорт Obsidian (хранилище или подпапка)…', click:() => mainWindow.webContents.send('menu:project','import')},
        {type:'separator'},
        {
          label: 'Сохранить',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('menu:save')
        },
        {
          label: 'Сохранить копию проекта / хранилища…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow.webContents.send('menu:save-as')
        },
        {
          label: 'Открыть хранилище...',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow.webContents.send('menu:open')
        },
        { type: 'separator' },
        {
          label: 'Экспорт',
          submenu: [
            { label: 'Граф в GraphML...', click: () => mainWindow.webContents.send('menu:export', 'graphml') },
            { label: 'Гео в GeoJSON...', click: () => mainWindow.webContents.send('menu:export', 'geojson') },
            { label: 'Таймлайн в CSV...', click: () => mainWindow.webContents.send('menu:export', 'csv') }
          ]
        },
        {
          label: 'Импорт источников (BibTeX)...',
          click: () => mainWindow.webContents.send('menu:import-bibtex')
        },
        { type: 'separator' },
        {
          label: 'Показать папку хранилища',
          click: () => shell.showItemInFolder(currentVaultPath)
        },
        { type: 'separator' },
        { role: 'quit', label: 'Выход' }
      ]
    },
    {
      label: 'Правка',
      submenu: [
        { role: 'undo', label: 'Отменить' },
        { role: 'redo', label: 'Повторить' },
        { type: 'separator' },
        { role: 'cut', label: 'Вырезать' },
        { role: 'copy', label: 'Копировать' },
        { role: 'paste', label: 'Вставить' }
      ]
    },
    {
      label: 'Вид',
      submenu: [
        { role: 'reload', label: 'Обновить' },
        { role: 'toggleDevTools', label: 'Инструменты разработчика' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Сбросить масштаб' },
        { role: 'zoomIn', label: 'Увеличить' },
        { role: 'zoomOut', label: 'Уменьшить' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Полноэкранный режим' }
      ]
    }
  ];
}

ipcMain.handle('vault:load', async () => {
  const settings = path.join(app.getPath('userData'),'workspace.json');
  if (fs.existsSync(settings)) {
    const saved = JSON.parse(fs.readFileSync(settings,'utf8'));
    if (saved.projectRoot && fs.existsSync(saved.projectRoot)) return activateProject(saved.projectRoot);
  }
  currentVaultPath = getDefaultVaultPath();
  ensureVaultExists(currentVaultPath);
  return { filePath: currentVaultPath, data: readVault(currentVaultPath) };
});

ipcMain.handle('vault:save', (_event, data) => {
  const filePath = currentVaultPath || getDefaultVaultPath();
  if (projectRoot) workspace.save(projectRoot,data);
  else writeVault(filePath, data);
  currentVaultPath = filePath;
  return { filePath };
});

ipcMain.handle('vault:save-as', async (_event, data) => {
  if (projectRoot) {
    const chosen = await dialog.showOpenDialog(mainWindow,{title:'Выберите пустую папку для копии проекта',properties:['openDirectory','createDirectory']});
    if (chosen.canceled) return null;
    const target = chosen.filePaths[0];
    if (fs.readdirSync(target).length) throw new Error('Папка должна быть пустой');
    if (path.resolve(target).startsWith(path.resolve(projectRoot)+path.sep) || path.resolve(projectRoot).startsWith(path.resolve(target)+path.sep)) throw new Error('Копия должна находиться вне исходного проекта');
    workspace.save(projectRoot,data);
    fs.cpSync(projectRoot,target,{recursive:true});
    return activateProject(target);
  }
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Сохранить хранилище как',
    defaultPath: 'vault.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) return null;
  writeVault(result.filePath, data);
  currentVaultPath = result.filePath;
  return { filePath: result.filePath };
});

ipcMain.handle('vault:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Открыть хранилище',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  const data = readVault(filePath);
  if (data.formatVersion) throw new Error('Проект нужно открывать через «Открыть папку как рабочее пространство»');
  if (!Array.isArray(data.notes) || !Array.isArray(data.layers)) throw new Error('Неверный формат хранилища');
  projectRoot = null; rememberProject();
  currentVaultPath = filePath;
  return { filePath, data };
});

ipcMain.handle('project:action', async (_event, action, data) => {
  if (!['new','open','import'].includes(action)) throw new Error('Неизвестная команда');
  if (action === 'import' && !projectRoot) throw new Error('Сначала создайте или откройте папку проекта');
  const result = await dialog.showOpenDialog(mainWindow, {
    title: action === 'new' ? 'Создать проект в пустой папке' : action === 'import' ? 'Выберите хранилище Obsidian или подпапку' : 'Открыть рабочее пространство',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled) return null;
  const root = result.filePaths[0];
  if (action === 'new' && fs.readdirSync(root).length) throw new Error('Для нового проекта выберите пустую папку');
  if (action === 'import') {
    workspace.save(projectRoot,data);
    const report = await workspace.importFolder(projectRoot,root);
    const opened = await activateProject(projectRoot);
    return {...opened,report};
  }
  return activateProject(root);
});

ipcMain.handle('attachment:add', async (_event, noteId) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Прикрепить файл',
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const srcPath = result.filePaths[0];
  const destDir = path.join(projectRoot || app.getPath('userData'), 'attachments', noteId.replace(/[^a-zA-Z0-9_-]/g,'_'));
  fs.mkdirSync(destDir, { recursive: true });
  const fileName = path.basename(srcPath);
  const destPath = path.join(destDir, fileName);
  fs.copyFileSync(srcPath, destPath);
  return { id: `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`, fileName, path: destPath, ...(projectRoot ? {file:path.relative(projectRoot,destPath).split(path.sep).join('/')} : {}) };
});

ipcMain.handle('attachment:open', (_event, filePath) => {
  shell.openPath(filePath);
});

ipcMain.handle('photo:set', async (_event, noteId) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Выбрать фото',
    properties: ['openFile'],
    filters: [{ name: 'Изображения', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const srcPath = result.filePaths[0];
  const destDir = path.join(projectRoot || app.getPath('userData'), 'photos', noteId.replace(/[^a-zA-Z0-9_-]/g,'_'));
  fs.mkdirSync(destDir, { recursive: true });
  const fileName = path.basename(srcPath);
  const destPath = path.join(destDir, fileName);
  fs.copyFileSync(srcPath, destPath);
  return { fileName, path: destPath, ...(projectRoot ? {file:path.relative(projectRoot,destPath).split(path.sep).join('/')} : {}) };
});

ipcMain.handle('link:open-external', (_event, url) => {
  if (/^https?:\/\//i.test(url)) shell.openExternal(url);
});

ipcMain.handle('file:export', async (_event, defaultName, content) => {
  const result = await dialog.showSaveDialog(mainWindow, { title: 'Экспорт', defaultPath: defaultName });
  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, content, 'utf-8');
  return result.filePath;
});

ipcMain.handle('file:import-bibtex', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Импорт источников (BibTeX)',
    properties: ['openFile'],
    filters: [{ name: 'BibTeX', extensions: ['bib'] }]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return fs.readFileSync(result.filePaths[0], 'utf-8');
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
