function escapeXml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  }[ch]));
}

/** Экспорт хранилища в GraphML (Gephi, yEd и т.п.) — узлы = заметки, рёбра = связи. */
export function exportToGraphML(data) {
  const layerById = new Map(data.layers.map((l) => [l.id, l]));

  const nodeLines = data.notes.map((n) => {
    const layer = layerById.get(n.layerId);
    return `    <node id="${escapeXml(n.id)}">
      <data key="label">${escapeXml(n.title)}</data>
      <data key="type">${escapeXml(n.type)}</data>
      <data key="layer">${escapeXml(layer ? layer.name : '')}</data>
    </node>`;
  });

  const noteIds = new Set(data.notes.map((n) => n.id));
  const edgeLines = [];
  const seen = new Set();
  for (const note of data.notes) {
    for (const link of note.links) {
      if (!noteIds.has(link.target)) continue;
      const key = `${note.id}->${link.target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edgeLines.push(`    <edge source="${escapeXml(note.id)}" target="${escapeXml(link.target)}">
      <data key="edgeType">${escapeXml(link.type)}</data>
    </edge>`);
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns">
  <key id="label" for="node" attr.name="label" attr.type="string"/>
  <key id="type" for="node" attr.name="type" attr.type="string"/>
  <key id="layer" for="node" attr.name="layer" attr.type="string"/>
  <key id="edgeType" for="edge" attr.name="edgeType" attr.type="string"/>
  <graph id="SplitHistory" edgedefault="directed">
${nodeLines.join('\n')}
${edgeLines.join('\n')}
  </graph>
</graphml>
`;
}
