/** Встроенные шаблоны заметок — задают тип и заготовку текста при создании. */
export const BUILTIN_TEMPLATES = [
  {
    id: 'blank',
    name: 'Пустая заметка',
    type: 'event',
    contentTemplate: ''
  },
  {
    id: 'person',
    name: 'Личность',
    type: 'person',
    contentTemplate: '## Кратко\n\n\n## Роль в контексте\n\n\n## Связанные события\n\n'
  },
  {
    id: 'event',
    name: 'Событие',
    type: 'event',
    contentTemplate: '## Что произошло\n\n\n## Участники\n\n\n## Последствия\n\n'
  },
  {
    id: 'source',
    name: 'Источник',
    type: 'source',
    contentTemplate: '## Аннотация\n\n\n## Ключевые утверждения\n\n'
  },
  {
    id: 'artifact',
    name: 'Артефакт / место',
    type: 'artifact',
    contentTemplate: '## Описание\n\n\n## История\n\n'
  }
];

export function getTemplate(id) {
  return BUILTIN_TEMPLATES.find((t) => t.id === id) || BUILTIN_TEMPLATES[0];
}

export function applyTemplate(template) {
  return {
    type: template.type,
    content: template.contentTemplate || ''
  };
}
