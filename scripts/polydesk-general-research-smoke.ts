import assert from 'node:assert/strict';

const priorComputeKey = process.env.ZG_COMPUTE_API_KEY;
const priorComputeBaseUrl = process.env.ZG_COMPUTE_BASE_URL;
const priorSearchBaseUrl = process.env.ZEROSCOUT_GENERAL_SEARCH_BASE_URL;
const priorSearchKey = process.env.ZEROSCOUT_GENERAL_SEARCH_API_KEY;
const priorModel = process.env.ZEROSCOUT_GENERAL_RESEARCH_MODEL;

process.env.ZG_COMPUTE_API_KEY = '0g-test-key';
process.env.ZG_COMPUTE_BASE_URL = 'https://router.0g.example/v1';
process.env.ZEROSCOUT_GENERAL_SEARCH_BASE_URL = 'https://search.example';
process.env.ZEROSCOUT_GENERAL_SEARCH_API_KEY = 'search-test-key';
process.env.ZEROSCOUT_GENERAL_RESEARCH_MODEL = 'gpt-5.6-sol';

const {
  buildPolyDeskResearchQueries,
  fetchPolyDeskGeneralResearch,
  polyDeskGeneralResearchConfigured,
  polyDeskGeneralResearchRequestSchema,
} = await import('../server/src/services/polydesk-general-research.js');
const { integrationUsesIncludedBilling } = await import('../server/src/repository.js');

const request = polyDeskGeneralResearchRequestSchema.parse({
  schema: 'zeroscout.polydesk-general-research.request',
  schemaVersion: '1.0.0',
  query: 'Federal Reserve: September decision?',
  market: {
    conditionId: '0x' + 'a'.repeat(64),
    question: 'Will the Federal Reserve change rates in September?',
    description: 'Example market.',
    resolutionRules: 'Resolves from the official Federal Reserve announcement.',
    resolutionSource: 'https://www.federalreserve.gov/',
  },
});

assert.equal(integrationUsesIncludedBilling({ billingMode: 'included' }), true);
assert.equal(integrationUsesIncludedBilling({ billingMode: 'metered' }), false);
assert.equal(integrationUsesIncludedBilling({}), false);
assert.equal(polyDeskGeneralResearchConfigured(), true);
assert.equal(polyDeskGeneralResearchRequestSchema.safeParse({
  ...request,
  market: { ...request.market, resolutionRules: '' },
}).success, false);

const seeds = buildPolyDeskResearchQueries(request);
assert.equal(seeds.length, 3);
assert.match(seeds.join(' '), /federal reserve/i);
assert.match(seeds.join(' '), /federalreserve\.gov/i);

const originalFetch = globalThis.fetch;
let searchCalls = 0;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
  if (url === 'https://router.0g.example/v1/chat/completions') {
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer 0g-test-key');
    assert.equal(body.model, 'gpt-5.6-sol');
    assert.match(JSON.stringify(body.messages), /Full resolution rules:/);
    assert.match(JSON.stringify(body.messages), /Research request:/);
    assert.match(JSON.stringify(body.messages), /Federal Reserve announcement/);
    return new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            queries: [
              'site:federalreserve.gov September rate decision official',
              'Federal Reserve September rate decision contradiction latest',
            ],
          }),
        },
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  assert.equal(url, 'https://search.example/search');
  assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer search-test-key');
  assert.equal(body.search_depth, 'advanced');
  assert.equal(body.include_answer, false);
  assert.equal(body.include_raw_content, 'text');
  searchCalls += 1;
  return new Response(JSON.stringify({
    results: [{
      title: searchCalls === 1 ? 'Federal Reserve policy update' : 'Independent policy coverage',
      url: searchCalls === 1
        ? 'https://www.federalreserve.gov/policy-update'
        : 'https://example.org/fed-coverage',
      content: 'Current evidence returned by the retrieval API.',
      published_date: '2026-09-01',
      score: searchCalls === 1 ? 0.98 : 0.8,
    }, {
      title: 'Social media commentary',
      url: 'https://www.facebook.com/example/posts/market-rumor',
      content: 'Unverified commentary must not become evidence.',
      score: 0.99,
    }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

try {
  const result = await fetchPolyDeskGeneralResearch(request);
  assert.equal(searchCalls, 2);
  assert.equal(result.model, 'gpt-5.6-sol');
  assert.equal(result.computeProvider, '0G Compute Router');
  assert.equal(result.retrievalProvider, 'Tavily Search');
  assert.equal(result.searchQueries.length, 2);
  assert.equal(result.articles.length, 2);
  assert.equal(result.articles[0].source, 'federalreserve.gov');
  assert.equal(result.articles[0].url, 'https://www.federalreserve.gov/policy-update');
  assert.equal(result.articles[0].evidenceRole, 'RESOLUTION_AUTHORITY');
  assert.match(result.articles[0].retrievedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(result.articles[1].evidenceRole, 'EXTERNAL_SOURCE');
} finally {
  globalThis.fetch = originalFetch;
  if (priorComputeKey === undefined) delete process.env.ZG_COMPUTE_API_KEY;
  else process.env.ZG_COMPUTE_API_KEY = priorComputeKey;
  if (priorComputeBaseUrl === undefined) delete process.env.ZG_COMPUTE_BASE_URL;
  else process.env.ZG_COMPUTE_BASE_URL = priorComputeBaseUrl;
  if (priorSearchBaseUrl === undefined) delete process.env.ZEROSCOUT_GENERAL_SEARCH_BASE_URL;
  else process.env.ZEROSCOUT_GENERAL_SEARCH_BASE_URL = priorSearchBaseUrl;
  if (priorSearchKey === undefined) delete process.env.ZEROSCOUT_GENERAL_SEARCH_API_KEY;
  else process.env.ZEROSCOUT_GENERAL_SEARCH_API_KEY = priorSearchKey;
  if (priorModel === undefined) delete process.env.ZEROSCOUT_GENERAL_RESEARCH_MODEL;
  else process.env.ZEROSCOUT_GENERAL_RESEARCH_MODEL = priorModel;
}

console.log('ZeroScout 0G-planned PolyDesk general-research smoke checks passed.');
