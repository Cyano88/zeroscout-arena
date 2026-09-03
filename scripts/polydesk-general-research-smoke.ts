import assert from 'node:assert/strict';
import {
  buildPolyDeskResearchQueries,
  fetchPolyDeskGeneralResearch,
  polyDeskGeneralResearchRequestSchema,
} from '../server/src/services/polydesk-general-research.js';
import { integrationUsesIncludedBilling } from '../server/src/repository.js';

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
assert.equal(polyDeskGeneralResearchRequestSchema.safeParse({
  ...request,
  market: { ...request.market, resolutionRules: '' },
}).success, false);

const queries = buildPolyDeskResearchQueries(request);
assert.equal(queries.length, 3);
assert.match(queries.join(' '), /federal reserve/i);
assert.match(queries.join(' '), /federalreserve\.gov/i);

const priorBaseUrl = process.env.ZEROSCOUT_GENERAL_RESEARCH_BASE_URL;
const priorKey = process.env.ZEROSCOUT_GENERAL_RESEARCH_API_KEY;
const priorModel = process.env.ZEROSCOUT_GENERAL_RESEARCH_MODEL;
const originalFetch = globalThis.fetch;
process.env.ZEROSCOUT_GENERAL_RESEARCH_BASE_URL = 'https://research.example/v1';
process.env.ZEROSCOUT_GENERAL_RESEARCH_API_KEY = 'test-key';
process.env.ZEROSCOUT_GENERAL_RESEARCH_MODEL = 'gpt-5.6';
globalThis.fetch = async (input, init) => {
  assert.equal(String(input), 'https://research.example/v1/responses');
  const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
  assert.equal(body.model, 'gpt-5.6');
  assert.deepEqual(body.tools, [{ type: 'web_search' }]);
  assert.equal(body.tool_choice, 'required');
  assert.match(String(body.input), /Full resolution rules:/);
  return new Response(JSON.stringify({
    output: [
      {
        type: 'web_search_call',
        action: { type: 'search', queries: ['Federal Reserve September official update'] },
      },
      {
        type: 'message',
        content: [{
          type: 'output_text',
          text: 'Federal Reserve officials published a current policy update.',
          annotations: [{
            type: 'url_citation',
            title: 'Federal Reserve policy update',
            url: 'https://www.federalreserve.gov/policy-update',
            start_index: 0,
            end_index: 60,
          }],
        }],
      },
    ],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

try {
  const result = await fetchPolyDeskGeneralResearch(request);
  assert.equal(result.model, 'gpt-5.6');
  assert.deepEqual(result.searchQueries, ['Federal Reserve September official update']);
  assert.equal(result.articles.length, 1);
  assert.equal(result.articles[0].source, 'federalreserve.gov');
  assert.equal(result.articles[0].url, 'https://www.federalreserve.gov/policy-update');
} finally {
  globalThis.fetch = originalFetch;
  if (priorBaseUrl === undefined) delete process.env.ZEROSCOUT_GENERAL_RESEARCH_BASE_URL;
  else process.env.ZEROSCOUT_GENERAL_RESEARCH_BASE_URL = priorBaseUrl;
  if (priorKey === undefined) delete process.env.ZEROSCOUT_GENERAL_RESEARCH_API_KEY;
  else process.env.ZEROSCOUT_GENERAL_RESEARCH_API_KEY = priorKey;
  if (priorModel === undefined) delete process.env.ZEROSCOUT_GENERAL_RESEARCH_MODEL;
  else process.env.ZEROSCOUT_GENERAL_RESEARCH_MODEL = priorModel;
}

console.log('ZeroScout PolyDesk general-research smoke checks passed.');
