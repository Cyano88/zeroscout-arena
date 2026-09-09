// Extract source text, never synthesize a fixture or silently resolve a conflict.
const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const tidy = (text: string) => text.replace(/[\x00-\x1f\x7f\s]+/g, ' ').trim();
const normalize = (text: string) => tidy(text).toLowerCase().replace(/\bman\b/g, 'manchester').replace(/\bfc\b/g, '').replace(/\s+/g, ' ').trim();
export function fixtureEvidence(question: string, candidate: { title: string; url: string; content: string; raw_content?: string | null; published_date?: string | null }, authority: boolean): string | null {
  const focus = /^Will (.+?) win on (\d{4})-(\d{2})-(\d{2})\??$/i.exec(question.trim());
  const source = tidy(candidate.raw_content || candidate.content);
  if (!focus) return source.slice(0, 1500);
  const entity = normalize(focus[1]);
  const target = Date.UTC(Number(focus[2]), Number(focus[3]) - 1, Number(focus[4]));
  // Keep offsets in the original source: aliases are used only for matching.
  const entityPattern = focus[1].replace(/\s+FC$/i, '').split(/\s+/).map(word => word.toLowerCase() === 'manchester' ? '(?:Manchester|Man)' : word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
  const matches = [...source.matchAll(new RegExp('\\b' + entityPattern + '\\b', 'gi'))];
  if (!matches.length || !entity) return null;
  const dates: { at: number; end: number; time: number }[] = [];
  const datePattern = /\b(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+)?(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+(20\d{2}))?\b/gi;
  for (const match of source.matchAll(datePattern)) {
    dates.push({ at: match.index!, end: match.index! + match[0].length, time: Date.UTC(Number(match[3] || focus[2]), months.indexOf(match[2].toLowerCase()), Number(match[1])) });
  }
  const windows = matches.map(match => {
    const at = match.index!;
    const heading = dates.filter(date => date.end <= at).at(-1);
    const distance = heading ? Math.abs(heading.time - target) : Infinity;
    const start = heading && at - heading.at < 650 ? heading.at : Math.max(0, at - 300);
    return { start, distance, at };
  }).sort((a, b) => a.distance - b.distance || a.at - b.at);
  const best = windows[0];
  // Preview titles must identify this entity; old/different fixtures must not
  // qualify merely because navigation or a transfer paragraph mentions it.
  const preview = /\b(vs\.?|versus|prediction|predicted|preview|lineups?)\b/i.test(candidate.title);
  if (!authority && preview) {
    if (!normalize(candidate.title).includes(entity)) return null;
    const published = Date.parse(candidate.published_date || '');
    if (Number.isFinite(published) && target - published > 30 * 86400000) return null;
    const iso = focus[2] + '-' + focus[3] + '-' + focus[4];
    const reverse = focus[4] + '-' + focus[3] + '-' + focus[2].slice(2);
    const monthFirst = new RegExp(months[Number(focus[3]) - 1] + '\\s+' + Number(focus[4]) + '(?!\\d)(?:,?\\s+' + focus[2] + ')?(?!,?\\s+20\\d{2})', 'i');
    const exactDate = candidate.url.includes(iso) || candidate.url.includes(reverse) || source.includes(iso) || monthFirst.test(source) || best.distance === 0;
    if (!exactDate) return null;
  }
  // Label the excerpt and preserve its date heading, including conflicting dates.
  const excerpt = source.slice(best.start, best.start + 1380);
  return 'Source excerpt (search-provider text; retrieval time is not publication/update time): ' + excerpt;
}
