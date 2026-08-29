"use strict";

// Taxonomy label matcher derived entirely from the shipped dictionary.
// No hardcoded business vocabulary: if the dictionary changes, matching
// follows it. Longest label wins to avoid partial-label collisions.

function buildMatcher(taxonomy) {
  const entries = [];
  for (const field of taxonomy.fields) {
    for (const value of field.values ?? []) {
      if (value.status === "disabled") continue;
      entries.push({fieldCode: field.fieldCode, code: value.code, parentCode: value.parentCode ?? null, label: value.label});
    }
  }
  entries.sort((a, b) => b.label.length - a.label.length);
  return {
    fields: taxonomy.fields,
    match(text) {
      const hits = [];
      for (const entry of entries) {
        if (text.includes(entry.label)) hits.push(entry);
      }
      return hits;
    },
  };
}

module.exports = {buildMatcher};
