import { describe, it, expect } from 'vitest';
import { extractHeadings, renderMarkdownToHtml } from '../src/utils.js';

describe('extractHeadings', () => {
  it('extracts headings with their level in order', () => {
    const content = '# Заголовок 1\ntext\n## Заголовок 2\nmore\n### Заголовок 3';
    expect(extractHeadings(content)).toEqual([
      { level: 1, text: 'Заголовок 1' },
      { level: 2, text: 'Заголовок 2' },
      { level: 3, text: 'Заголовок 3' }
    ]);
  });

  it('ignores lines that are not headings', () => {
    expect(extractHeadings('обычный текст\n#нет пробела\n')).toEqual([]);
  });

  it('returns an empty array for empty content', () => {
    expect(extractHeadings('')).toEqual([]);
  });
});

describe('renderMarkdownToHtml', () => {
  it('renders headings with level-specific ids and classes', () => {
    const html = renderMarkdownToHtml('# Заголовок', [], null);
    expect(html).toContain('id="md-h-0"');
    expect(html).toContain('class="md-heading md-h1"');
    expect(html).toContain('Заголовок');
  });

  it('assigns sequential heading ids matching extractHeadings order', () => {
    const content = '# A\ntext\n## B';
    const html = renderMarkdownToHtml(content, [], null);
    expect(html).toContain('id="md-h-0"');
    expect(html).toContain('id="md-h-1"');
  });

  it('renders bold, italic and inline code', () => {
    const html = renderMarkdownToHtml('**жирный** и *курсив* и `код`', [], null);
    expect(html).toContain('<strong>жирный</strong>');
    expect(html).toContain('<em>курсив</em>');
    expect(html).toContain('<code>код</code>');
  });

  it('renders a resolved wiki-link with the target note id', () => {
    const notes = [{ id: 'n1', title: 'Исаак Ньютон' }];
    const html = renderMarkdownToHtml('см. [[Исаак Ньютон]]', notes, null);
    expect(html).toContain('class="md-wikilink resolved" data-note-id="n1"');
  });

  it('renders an unresolved wiki-link distinctly', () => {
    const html = renderMarkdownToHtml('[[Неизвестно]]', [], null);
    expect(html).toContain('md-wikilink unresolved');
  });

  it('renders unordered and ordered lists', () => {
    const html = renderMarkdownToHtml('- один\n- два', [], null);
    expect(html).toBe('<ul><li>один</li><li>два</li></ul>');

    const htmlOl = renderMarkdownToHtml('1. один\n2. два', [], null);
    expect(htmlOl).toBe('<ol><li>один</li><li>два</li></ol>');
  });

  it('escapes raw HTML in content', () => {
    const html = renderMarkdownToHtml('<script>alert(1)</script>', [], null);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('shows a placeholder for empty content', () => {
    expect(renderMarkdownToHtml('', [], null)).toContain('md-empty');
  });
});
