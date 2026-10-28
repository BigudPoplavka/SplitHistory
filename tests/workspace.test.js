import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import workspace from '../workspace.cjs';
import { references, resolveFile, extractTags } from '../src/obsidian.mjs';
import { renderMarkdownToHtml } from '../src/utils.js';
const roots = [];
function temp() { const root = fs.mkdtempSync(path.join(os.tmpdir(),'splithistory-test-')); roots.push(root); return root; }
function put(root,file,text) { const full = path.join(root,file); fs.mkdirSync(path.dirname(full),{recursive:true}); fs.writeFileSync(full,text); }
afterEach(() => {
  for (const root of roots.splice(0)) {
    if (path.dirname(root) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith('splithistory-test-')) throw new Error('Unsafe test cleanup');
    fs.rmSync(root,{recursive:true,force:true});
  }
});
describe('Obsidian references', () => {
  it('resolves relative, root and unique short links, refuses ambiguous basenames', () => {
    const files = ['a/Note.md','b/Note.md','b/Other.md'];
    expect(resolveFile({file:'../b/Other.md',wiki:false},'a/Note.md',files)).toBe('b/Other.md');
    expect(resolveFile({file:'b/Other',wiki:true},'a/Note.md',files)).toBe('b/Other.md');
    expect(resolveFile({file:'Note',wiki:true},'c/Home.md',files)).toBeNull();
    expect(references('[[b/Other#Heading|alias]] ![[photo.png]] [note](b/Other.md#block) `[[ignored]]`')).toHaveLength(3);
    expect(references('[web](https://example.com)')).toEqual([]);
  });
  it('indexes YAML list and inline tags without changing the text', () => {
    expect(extractTags('---\ntags: [one, "two"]\n---\n#nested/tag #2026')).toEqual(['one','two','nested/tag']);
    expect(extractTags('---\ntags:\n  - one\n  - two\n---\n')).toEqual(['one','two']);
  });
});
describe('folder projects', () => {
  it('uses relative precedence for Markdown and vault-root precedence for wikilinks', () => {
    const notes = [
      {id:'home',file:'folder/Home.md',title:'Home'},
      {id:'local',file:'folder/B.md',title:'B'},
      {id:'root',file:'B.md',title:'B'}
    ];
    expect(renderMarkdownToHtml('[B](B.md)',notes,'home')).toContain('data-note-id="local"');
    expect(renderMarkdownToHtml('[[B.md]]',notes,'home')).toContain('data-note-id="root"');
  });
  it('imports a subfolder and transitive dependencies, preserves bytes, links, tags and media', async () => {
    const source = temp(); const target = temp();
    put(source,'.obsidian/app.json','{}');
    const text = '\uFEFF---\r\ntags: [history]\r\n---\r\n[[../Elsewhere/B#Part|alias]] ![[image.png]]\r\n#inline';
    put(source,'Selected/A.md',text);
    put(source,'Elsewhere/B.md','[C](C.md)');
    put(source,'Elsewhere/C.md','[[Missing]]');
    put(source,'media/image.png',Buffer.from([1,2,3]));
    put(source,'NotSelected.md','not linked');
    const report = await workspace.importFolder(target,path.join(source,'Selected'));
    expect(report.count).toBe(3);
    expect(report.unresolved).toHaveLength(1);
    const data = await workspace.open(target);
    expect(data.notes.map(n => n.title).sort()).toEqual(['A','B','C']);
    expect(data.layers.find(l => l.origin === 'obsidian').name).toBe('Обсидиан');
    const a = data.notes.find(n => n.title === 'A'); const b = data.notes.find(n => n.title === 'B');
    expect(a.content).toBe(text);
    expect(a.tags).toEqual(['history','inline']);
    expect(a.links[0].target).toBe(b.id);
    expect(fs.readFileSync(a.attachments[0].path)).toEqual(Buffer.from([1,2,3]));
    const html = renderMarkdownToHtml(a.content,data.notes,a.id);
    expect(html).toContain('data-note-id="'+b.id+'"');
    expect(html).toContain('<img');
    workspace.save(target,data);
    expect(fs.readFileSync(path.join(target,a.file),'utf8')).toBe(text);
    expect(JSON.parse(fs.readFileSync(path.join(target,workspace.INDEX),'utf8')).notes[0].content).toBeUndefined();
    const copy = temp(); fs.cpSync(target,copy,{recursive:true});
    const reopened = await workspace.open(copy);
    expect(reopened.notes.find(n => n.title === 'A').attachments[0].path.startsWith(copy)).toBe(true);
    expect(reopened.notes.find(n => n.title === 'A').links[0].target).toBe(b.id);
    expect(fs.readFileSync(path.join(source,'Selected/A.md'),'utf8')).toBe(text);
  });
  it('opens a Markdown folder, saves new notes, rejects external conflicts and trashes deleted notes', async () => {
    const root = temp(); put(root,'A.md','initial');
    const data = await workspace.open(root); workspace.save(root,data);
    data.notes[0].content = 'edited'; workspace.save(root,data);
    put(root,'A.md','external'); data.notes[0].content = 'unsaved';
    expect(() => workspace.save(root,data)).toThrow('Файл изменён извне');
    expect(fs.readFileSync(path.join(root,'A.md'),'utf8')).toBe('external');
    const reopened = await workspace.open(root); workspace.save(root,reopened);
    reopened.notes.push({id:'new-note',title:'New',content:'new',layerId:reopened.notes[0].layerId});
    workspace.save(root,reopened);
    expect(fs.readFileSync(path.join(root,'notes/new-note.md'),'utf8')).toBe('new');
    reopened.notes = reopened.notes.filter(n => n.file !== 'A.md'); workspace.save(root,reopened);
    expect(fs.existsSync(path.join(root,'A.md'))).toBe(false);
    expect(fs.readdirSync(path.join(root,'.splithistory/trash'))).toHaveLength(1);
  });
  it('rejects escaping paths and nested imports', async () => {
    const root = temp();
    expect(() => workspace.inside(root,'../escape')).toThrow();
    expect(() => workspace.inside(root,path.resolve(root,'absolute'))).toThrow();
    await expect(workspace.importFolder(root,root)).rejects.toThrow();
  });
});
