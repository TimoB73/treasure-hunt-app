const USER_AGENT = 'Schatzsuche-App/0.2 (Cloud Function; https://github.com/timob73/treasure-hunt-app)'
const MAX_CHARS = 1200

/**
 * Lädt die Einleitung des Wikipedia-Artikels zum OSM-Tag `wikipedia` (Format „de:Titel“).
 * Fehler sind nicht schlimm – dann gibt es für diesen Ort eben keine Wikipedia-Fakten.
 */
export async function fetchWikipediaExtract(tag: string | undefined): Promise<string | null> {
  const match = tag?.match(/^([a-z-]{2,12}):(.+)$/)
  if (!match) return null
  const [, lang, title] = match
  try {
    const res = await fetch(
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`,
      { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(8_000) },
    )
    if (!res.ok) return null
    const data = (await res.json()) as { type?: string; extract?: string }
    if (data.type === 'disambiguation' || !data.extract) return null
    return data.extract.length > MAX_CHARS ? `${data.extract.slice(0, MAX_CHARS)} …` : data.extract
  } catch {
    return null
  }
}
