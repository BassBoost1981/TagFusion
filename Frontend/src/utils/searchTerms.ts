/**
 * Split a raw search query into terms: comma- or whitespace-separated,
 * trimmed, empties and duplicates removed.
 * Zerlegt den Suchtext in Begriffe (Komma/Leerzeichen), entfernt Leere und Duplikate.
 */
export function parseSearchTerms(query: string): string[] {
  return [
    ...new Set(
      query
        .split(/[,\s]+/)
        .map((t) => t.trim())
        .filter(Boolean)
    ),
  ];
}
