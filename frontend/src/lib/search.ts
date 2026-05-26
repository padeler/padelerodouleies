/** Normalize a search term: NFD decompose + strip accents + lowercase. */
export function normalizeSearchTerm(query: string): string {
  return query.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
