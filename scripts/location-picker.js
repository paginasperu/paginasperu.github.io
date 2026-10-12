export function normalizeLocationSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-PE")
    .trim();
}

export function prepareLocationOptions(rows) {
  const unique = new Map();
  for (const row of rows) {
    if (!row?.departamento || !row?.provincia || !row?.distrito) continue;
    const option = {
      departamento: row.departamento.trim(),
      provincia: row.provincia.trim(),
      distrito: row.distrito.trim(),
    };
    const key = [option.distrito, option.provincia, option.departamento].join("|");
    if (unique.has(key)) continue;
    option.label = `${option.distrito} — ${option.provincia} — ${option.departamento}`;
    option.searchText = normalizeLocationSearch(option.distrito);
    unique.set(key, option);
  }
  return [...unique.values()].sort((a, b) => a.label.localeCompare(b.label, "es-PE"));
}

export function searchLocations(options, query, limit = 20) {
  const terms = normalizeLocationSearch(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return { matches: [], total: 0 };
  const filtered = options.filter((option) => terms.every((term) => option.searchText.includes(term)));
  return { matches: filtered.slice(0, limit), total: filtered.length };
}
