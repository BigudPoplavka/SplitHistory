const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const INDEX = '.splithistory/project.json';
function inside(root, relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative)) throw new Error('Недопустимый путь проекта');
  const target = path.resolve(root, relative);
  if (!target.startsWith(path.resolve(root) + path.sep)) throw new Error('Путь вне проекта');
  let cursor = target;
  while (cursor !== path.resolve(root)) {
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) throw new Error('Символические ссылки не поддерживаются');
    cursor = path.dirname(cursor);
  }
  return target;
}
function scan(root, prefix = '') {
  return fs.readdirSync(prefix ? inside(root, prefix) : root, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.') || entry.isSymbolicLink() || entry.name === 'node_modules') return [];
    const file = prefix ? prefix + '/' + entry.name : entry.name;
    return entry.isDirectory() ? scan(root, file) : [file];
  });
}
function atomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.' + randomUUID() + '.tmp';
  try { fs.writeFileSync(temp, content); fs.renameSync(temp, file); }
  finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}
function empty() {
  return { layers: [{id:'map', name:'Карта', kind:'map', order:0, color:'#e0645a', visible:true, opacity:1}], notes:[] };
}
async function refresh(root, data) {
  const { references, resolveFile, extractTags } = await import('./src/obsidian.mjs');
  const files = scan(root);
  let layer = data.layers.find(l => l.origin === 'obsidian');
  for (const file of files.filter(f => /\.md$/i.test(f))) {
    let note = data.notes.find(n => n.file === file);
    if (!note) {
      if (!layer) { layer = {id:randomUUID(), name:'Обсидиан', origin:'obsidian', kind:'notes', order:data.layers.length, color:'#a88beb', visible:true, opacity:0.85}; data.layers.push(layer); }
      note = {id:randomUUID(), title:path.basename(file).replace(/\.md$/i,''), file, layerId:layer.id, type:'other', links:[], tags:[], attachments:[]};
      data.notes.push(note);
    }
    note.content = fs.readFileSync(inside(root, file), 'utf8');
    note.tags = [...new Set([...(note.tags || []), ...extractTags(note.content)])];
  }
  // A missing externally deleted file is an error, never silently recreated.
  for (const note of data.notes) {
    if (!note.file || !fs.existsSync(inside(root,note.file))) throw new Error(`Не найден Markdown: ${note.file}`);
    note.links = (note.links || []).filter(l => !l.imported);
    note.attachments = (note.attachments || []).filter(a => !a.imported);
    note.sourceLinks = [];
    for (const ref of references(note.content)) {
      const scope = /^Obsidian\/[^/]+\//.exec(note.file)?.[0] || '';
      const resolved = resolveFile(ref, note.file.slice(scope.length), files.filter(f => f.startsWith(scope)).map(f => f.slice(scope.length)));
      const file = resolved ? scope + resolved : null;
      const target = data.notes.find(n => n.file === file);
      note.sourceLinks.push({raw:ref.raw, file, target:target?.id || null});
      if (target && target.id !== note.id && !note.links.some(l => l.target === target.id)) note.links.push({target:target.id, type:'упоминание', imported:true});
      else if (file && !target && !note.attachments.some(a => a.file === file)) note.attachments.push({id:randomUUID(), fileName:path.basename(file), file, path:inside(root,file), imported:true});
    }
    for (const att of note.attachments || []) if (att.file) att.path = inside(root,att.file);
    if (note.photo?.file) note.photo.path = inside(root,note.photo.file);
  }
  return data;
}
async function open(root) {
  const file = inside(root, INDEX);
  const data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file,'utf8')) : empty();
  if (data.formatVersion && data.formatVersion !== 1) throw new Error('Версия проекта не поддерживается');
  if (!Array.isArray(data.layers) || !Array.isArray(data.notes)) throw new Error('Неверный формат проекта');
  await refresh(root,data);
  return data;
}
function save(root, input) {
  const data = structuredClone(input);
  const previous = fs.existsSync(inside(root,INDEX)) ? JSON.parse(fs.readFileSync(inside(root,INDEX),'utf8')) : {notes:[]};
  for (const note of data.notes) {
    note.file ||= 'notes/' + note.id.replace(/[^a-zA-Z0-9_-]/g,'_') + '.md';
    if (!/\.md$/i.test(note.file) || note.file.replace(/\\/g,'/').split('/').some(part => part.startsWith('.'))) throw new Error('Недопустимый путь Markdown');
    const file = inside(root,note.file);
    const old = previous.notes.find(n => n.id === note.id);
    if (old && fs.existsSync(file)) {
      const disk = fs.readFileSync(file,'utf8');
      const { createHash } = require('crypto');
      const hash = createHash('sha256').update(disk).digest('hex');
      if (old.contentHash && old.contentHash !== hash && disk !== note.content) throw new Error(`Файл изменён извне: ${note.file}. Обновите окно через меню «Вид → Обновить».`);
    } else if (!old && fs.existsSync(file) && fs.readFileSync(file,'utf8') !== (note.content || '')) throw new Error(`Файл уже существует: ${note.file}`);
    if (!fs.existsSync(file) || fs.readFileSync(file,'utf8') !== (note.content || '')) atomic(file,note.content || '');
    note.contentHash = require('crypto').createHash('sha256').update(note.content || '').digest('hex');
    delete note.content;
    // Paths in the index stay relative so the project can be moved.
    for (const att of note.attachments || []) if (att.file) delete att.path;
    if (note.photo?.file) delete note.photo.path;
    delete note.sourceLinks;
  }
  atomic(inside(root,INDEX),JSON.stringify({...data,formatVersion:1}));
  // Only formerly managed notes are moved to a recoverable trash folder.
  for (const old of previous.notes) if (!data.notes.some(n => n.file === old.file) && old.file && fs.existsSync(inside(root,old.file))) {
    const dest = inside(root,'.splithistory/trash/' + randomUUID() + '.md');
    fs.mkdirSync(path.dirname(dest),{recursive:true}); fs.renameSync(inside(root,old.file),dest);
  }
}
async function importFolder(root, selected) {
  let sourceRoot = selected;
  for (let parent = selected;; parent = path.dirname(parent)) {
    if (fs.existsSync(path.join(parent,'.obsidian'))) { sourceRoot = parent; break; }
    if (path.dirname(parent) === parent) break;
  }
  if (path.resolve(root) === path.resolve(sourceRoot) || path.resolve(root).startsWith(path.resolve(sourceRoot)+path.sep) || path.resolve(sourceRoot).startsWith(path.resolve(root)+path.sep)) throw new Error('Источник и проект должны быть отдельными папками');
  const { references, resolveFile } = await import('./src/obsidian.mjs');
  const files = scan(sourceRoot);
  const prefix = path.relative(sourceRoot,selected).split(path.sep).join('/');
  const chosen = new Set(files.filter(f => !prefix || f.startsWith(prefix+'/')));
  const unresolved = [];
  for (const file of chosen) if (/\.md$/i.test(file)) {
    for (const ref of references(fs.readFileSync(inside(sourceRoot,file),'utf8'))) {
      const resolved = resolveFile(ref,file,files);
      if (resolved) chosen.add(resolved);
      else unresolved.push(`${file}: ${ref.raw}`);
    }
  }
  const base = 'Obsidian/' + randomUUID();
  for (const file of chosen) {
    const dest = inside(root,base+'/'+file);
    fs.mkdirSync(path.dirname(dest),{recursive:true}); fs.copyFileSync(inside(sourceRoot,file),dest,fs.constants.COPYFILE_EXCL);
  }
  return { count:[...chosen].filter(f => /\.md$/i.test(f)).length, unresolved };
}
module.exports = { INDEX, inside, scan, empty, open, save, importFolder, refresh };
