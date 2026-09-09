import assert from 'node:assert/strict';
import test from 'node:test';
import { fixtureEvidence } from '../server/src/services/fixture-evidence.js';
const question = 'Will Manchester United FC win on 2026-09-13?';
const candidate = (text: string, title = 'All season fixtures', url = 'https://league.example/fixtures') => ({ title, url, content: text, raw_content: text });
test('preserves the relevant heading beyond the former 1500-character cutoff', () => {
  const raw = 'Saturday 22 August 2026 Hull City v Manchester United ' + 'Other fixtures '.repeat(220) + 'Sunday 13 September 16:30 Manchester United v Manchester City Monday 14 September Leeds v Newcastle';
  const result = fixtureEvidence(question, candidate(raw), true)!;
  assert.match(result, /Sunday 13 September 16:30 Manchester United v Manchester City/);
  assert(result.length <= 1500);
});
test('retains contradictory official fixture dates instead of rewriting them', () => {
  const result = fixtureEvidence(question, candidate('Saturday 12 September Manchester United v Manchester City Saturday 19 September Fulham v Manchester United'), true)!;
  assert.match(result, /Saturday 12 September Manchester United v Manchester City/);
  assert(!result.includes('Sunday 13 September'));
});
test('rejects unrelated previews even if the body mentions the requested team', () => {
  for (const row of [
    candidate('September 6, 2026 Everton v Manchester United', 'Everton vs Manchester United prediction'),
    candidate('March 20, 2026 Bournemouth vs Manchester United', 'Bournemouth vs Manchester United preview'),
    candidate('September 13, 2026 Chelsea v Leeds. Navigation Manchester United', 'Chelsea vs Leeds preview'),
    candidate('September 10, 2026 Manchester United v Sabah', 'Manchester United vs Sabah predicted lineup'),
  ]) assert.equal(fixtureEvidence(question, row, false), null);
});
test('accepts date-specific previews and preserves exact source text', () => {
  const row = candidate('Navigation '.repeat(200) + 'Manchester United host Manchester City on Sunday, September 13, 2026.', 'Manchester United vs Manchester City preview');
  assert.match(fixtureEvidence(question, row, false)!, /Manchester United host Manchester City/);
});
test('supports different teams and dates without hardcoding the derby', () => {
  assert.match(fixtureEvidence('Will Arsenal FC win on 2027-02-08?', candidate('Sunday 7 February Chelsea v Leeds Monday 8 February Arsenal v Everton'), true)!, /Monday 8 February Arsenal/);
});
test('does not let the same month and day from an older year pass as current', () => {
  const old = candidate('Manchester United host Manchester City on September 13, 2025.', 'Manchester United vs Manchester City preview');
  assert.equal(fixtureEvidence(question, old, false), null);
  assert.equal(fixtureEvidence(question, { ...old, published_date: '2025-09-12' }, false), null);
});
test('non-fixture research keeps the existing bounded behavior', () => {
  assert.equal(fixtureEvidence('Will rates change?', candidate('Rate decision evidence'), false), 'Rate decision evidence');
});
test('rejects transfer rumours and generic policy or season-odds pages', () => {
  for (const title of ['Transfer news: Manchester United suffer blow - Paper Talk', '2026/27 Premier League Odds - Contenders & Predictions', 'How do other competitions fixtures affect Premier League clubs']) {
    assert.equal(fixtureEvidence(question, candidate('Sunday 13 September Manchester United v Manchester City', title), true), null);
  }
});
test('does not treat an undated team-title article as evidence for the fixture', () => {
  assert.equal(fixtureEvidence(question, candidate('They started the season with one win, one draw and one loss. News about Manchester United.', 'Man United Manchester City', 'https://news.example/ambiguous'), false), null);
});
test('supports ordinal and abbreviated date headings and excludes subsequent dates', () => {
  for (const day of ['Sunday 13th September 2026', 'Sun 13 Sep']) {
    const result = fixtureEvidence(question, candidate('Thursday 10 September Manchester United versus Sabah. ' + day + ' Manchester United versus Manchester City Monday 14 September Leeds versus Newcastle'), true)!;
    assert(result.includes(day));
    assert(!result.includes('Sabah'));
    assert(!result.includes('Leeds'));
    assert.match(result, /Team attribution requires an explicit subject/);
  }
});
test('actual retrieval pipeline preserves current and conflicting fixture passages and drops unrelated previews', async () => {
  const { config } = await import('../server/src/config.js');
  const { fetchPolyDeskGeneralResearch } = await import('../server/src/services/polydesk-general-research.js');
  const priorKey = config.computeApiKey;
  const priorSearch = process.env.ZEROSCOUT_GENERAL_SEARCH_API_KEY;
  const priorFetch = globalThis.fetch;
  config.computeApiKey = 'fixture';
  process.env.ZEROSCOUT_GENERAL_SEARCH_API_KEY = 'fixture';
  let searchCalls = 0;
  globalThis.fetch = async url => {
    if (String(url).endsWith('/chat/completions')) return Response.json({ choices: [{ message: { content: JSON.stringify({ queries: ['official fixture', 'current fixture', 'conflicting fixture'] }) } }] });
    searchCalls++;
    return Response.json({ results: [
      { ...candidate('August schedule '.repeat(200) + 'Sunday 13 September 16:30 Manchester United v Manchester City', 'Updated schedule', 'https://league.example/current'), score: 0.9 },
      { ...candidate('Saturday 12 September Manchester United v Manchester City', 'Season release', 'https://league.example/original'), score: 0.8 },
      { ...candidate('September 6, 2026 Everton v Manchester United', 'Everton vs Manchester United preview', 'https://news.example/everton'), score: 0.99, published_date: '2026-09-05' },
    ] });
  };
  try {
    const result = await fetchPolyDeskGeneralResearch({ schema: 'zeroscout.polydesk-general-research.request', schemaVersion: '1.0.0', query: question, market: { conditionId: '0x' + 'b'.repeat(64), question, resolutionRules: 'Official result', resolutionSource: 'https://league.example' } });
    assert.equal(searchCalls, 3);
    assert.equal(result.articles.length, 2);
    assert.match(result.articles.find(a => a.url.endsWith('/current'))!.description, /Sunday 13 September 16:30 Manchester United v Manchester City/);
    assert.match(result.articles.find(a => a.url.endsWith('/original'))!.description, /Saturday 12 September/);
    assert(result.articles.every(a => a.description.length <= 1500));
  } finally {
    globalThis.fetch = priorFetch;
    config.computeApiKey = priorKey;
    if (priorSearch === undefined) delete process.env.ZEROSCOUT_GENERAL_SEARCH_API_KEY;
    else process.env.ZEROSCOUT_GENERAL_SEARCH_API_KEY = priorSearch;
  }
});
