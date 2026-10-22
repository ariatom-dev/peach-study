/** Turns pasted text into cards. One card per line: "Term: definition" (also — or |). */
export function parseTerms(text) {
  return text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.+?)\s*(?::|—|\|)\s*(.+)$/);
      if (!match) return null;
      return { term: match[1].trim(), definition: match[2].trim() };
    })
    .filter((item) => item && item.term && item.definition);
}
