import assert from 'node:assert/strict';
import {
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

const priorUrl = process.env.ZEROSCOUT_GENERAL_RESEARCH_URL;
const priorKey = process.env.ZEROSCOUT_GENERAL_RESEARCH_API_KEY;
const originalFetch = globalThis.fetch;
process.env.ZEROSCOUT_GENERAL_RESEARCH_URL = 'https://research.example/search';
delete process.env.ZEROSCOUT_GENERAL_RESEARCH_API_KEY;
globalThis.fetch = async input => {
  const url = new URL(String(input));
  assert.equal(url.searchParams.get('q'), 'Federal Reserve September decision');
  return new Response(JSON.stringify({
    articles: [{
      title: 'Federal Reserve officials review September policy',
      description: 'Officials are reviewing current inflation and employment data.',
      url: 'https://publisher.example/fed-policy',
      publishedAt: '2026-09-02T12:00:00.000Z',
      source: { name: 'Example Publisher' },
    }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

try {
  const articles = await fetchPolyDeskGeneralResearch(request);
  assert.equal(articles.length, 1);
  assert.equal(articles[0].source, 'Example Publisher');
  assert.equal(articles[0].url, 'https://publisher.example/fed-policy');
} finally {
  globalThis.fetch = originalFetch;
  if (priorUrl === undefined) delete process.env.ZEROSCOUT_GENERAL_RESEARCH_URL;
  else process.env.ZEROSCOUT_GENERAL_RESEARCH_URL = priorUrl;
  if (priorKey === undefined) delete process.env.ZEROSCOUT_GENERAL_RESEARCH_API_KEY;
  else process.env.ZEROSCOUT_GENERAL_RESEARCH_API_KEY = priorKey;
}

console.log('ZeroScout PolyDesk general-research smoke checks passed.');
