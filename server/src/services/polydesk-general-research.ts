import { z } from 'zod';
import { config } from '../config.js';

export const polyDeskGeneralResearchRequestSchema = z.object({
  schema: z.literal('zeroscout.polydesk-general-research.request'),
  schemaVersion: z.literal('1.0.0'),
  query: z.string().trim().min(2).max(180),
  market: z.object({
    conditionId: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    question: z.string().trim().min(2).max(500),
    description: z.string().trim().max(8_000).optional(),
    resolutionRules: z.string().trim().min(2).max(12_000),
    resolutionSource: z.string().trim().max(500).optional(),
  }).strict(),
}).strict();

export type PolyDeskGeneralResearchRequest = z.infer<typeof polyDeskGeneralResearchRequestSchema>;

export type PolyDeskGeneralResearchArticle = {
  title: string;
  description: string;
  source: string;
  url: string;
  publishedAt: string;
};

export type PolyDeskGeneralResearchResult = {
  articles: PolyDeskGeneralResearchArticle[];
  model: string;
  searchQueries: string[];
  computeProvider: '0G Compute Router';
  retrievalProvider: 'Tavily Search';
};

type CacheEntry = { expiresAt: number; result: PolyDeskGeneralResearchResult };

const cache = new Map<string, CacheEntry>();
const DEFAULT_MODEL = 'gpt-5.6-sol';
const DEFAULT_SEARCH_BASE_URL = 'https://api.tavily.com';
const DEFAULT_CACHE_MS = 10 * 60 * 1000;

const queryPlanSchema = z.object({
  queries: z.array(z.string().trim().min(3).max(300)).min(2).max(3),
}).strict();

const tavilyResultSchema = z.object({
  title: z.string().optional().default(''),
  url: z.string().url(),
  content: z.string().optional().default(''),
  raw_content: z.string().nullable().optional(),
  published_date: z.string().nullable().optional(),
  score: z.number().optional().default(0),
});

const tavilyResponseSchema = z.object({
  results: z.array(tavilyResultSchema).default([]),
});

function cleanText(value: string, max = 500): string {
  return value
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function keywordTerms(value: string): string[] {
  const stopWords = new Set([
    'about', 'after', 'before', 'could', 'from', 'have', 'into', 'market', 'official',
    'question', 'resolution', 'resolves', 'rules', 'shall', 'should', 'that', 'their',
    'there', 'these', 'this', 'those', 'through', 'under', 'will', 'with', 'would',
  ]);
  const seen = new Set<string>();
  return cleanText(value, 3_000)
    .toLowerCase()
    .match(/[\p{L}\p{N}][\p{L}\p{N}'-]{2,}/gu)
    ?.filter((term) => !stopWords.has(term))
    .filter((term) => {
      if (seen.has(term)) return false;
      seen.add(term);
      return true;
    })
    .slice(0, 14) ?? [];
}

function sourceHost(value: string | undefined): string {
  if (!value) return '';
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return cleanText(value, 120);
  }
}

export function buildPolyDeskResearchQueries(input: PolyDeskGeneralResearchRequest): string[] {
  const query = cleanText(input.query, 180);
  const question = cleanText(input.market.question, 300);
  const ruleTerms = keywordTerms(input.market.resolutionRules).slice(0, 8).join(' ');
  const authority = sourceHost(input.market.resolutionSource);
  return [...new Set([
    [query, 'latest verified update'].filter(Boolean).join(' '),
    [question, authority, 'official evidence'].filter(Boolean).join(' '),
    [ruleTerms, 'confirmation contradiction primary source'].filter(Boolean).join(' '),
  ].map((value) => cleanText(value, 300)).filter(Boolean))];
}

function parseJsonObject(value: string): unknown {
  const trimmed = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('0G research planner returned invalid JSON.');
  return JSON.parse(trimmed.slice(start, end + 1));
}

async function planQueriesWith0g(
  input: PolyDeskGeneralResearchRequest,
  model: string,
): Promise<string[]> {
  if (!config.computeApiKey) throw new Error('0G Compute Router is not configured.');
  const seeds = buildPolyDeskResearchQueries(input);
  const prompt = [
    'Create 2 to 3 precise web-search queries for evidence about this prediction market.',
    'Return JSON only: {"queries":["..."]}. Do not answer the market and do not invent URLs.',
    'Queries must cover: the official resolution authority, the newest confirming evidence, and credible contradictory evidence.',
    'Use distinctive entities, dates, thresholds, event names, and resolution keywords from the complete rules.',
    'Research request: ' + input.query,
    'Market question: ' + input.market.question,
    'Full resolution rules: ' + input.market.resolutionRules,
    input.market.resolutionSource ? 'Resolution source: ' + input.market.resolutionSource : '',
    'Deterministic seed queries: ' + seeds.join(' | '),
  ].filter(Boolean).join('\n');

  const response = await fetch(config.computeBaseUrl.replace(/\/+$/, '') + '/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + config.computeApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        { role: 'system', content: 'You are ZeroScout query planning running through 0G Compute. Output strict JSON only.' },
        { role: 'user', content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error('0G research planner failed with ' + response.status + '.');
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const first = choices[0] && typeof choices[0] === 'object' ? choices[0] as Record<string, unknown> : {};
  const message = first.message && typeof first.message === 'object' ? first.message as Record<string, unknown> : {};
  const content = typeof message.content === 'string' ? message.content : '';
  const plan = queryPlanSchema.parse(parseJsonObject(content));
  return [...new Set(plan.queries.map((query) => cleanText(query, 300)).filter(Boolean))];
}

async function searchTavily(query: string, apiKey: string, baseUrl: string) {
  const response = await fetch(baseUrl.replace(/\/+$/, '') + '/search', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      search_depth: 'advanced',
      topic: 'general',
      max_results: 5,
      include_answer: false,
      include_raw_content: 'text',
      include_images: false,
    }),
    signal: AbortSignal.timeout(25_000),
  });
  const payload = await response.json() as unknown;
  if (!response.ok) throw new Error('ZeroScout search retrieval failed with ' + response.status + '.');
  return tavilyResponseSchema.parse(payload).results;
}

export function polyDeskGeneralResearchConfigured(): boolean {
  return Boolean(config.computeApiKey?.trim() && process.env.ZEROSCOUT_GENERAL_SEARCH_API_KEY?.trim());
}

export async function fetchPolyDeskGeneralResearch(
  input: PolyDeskGeneralResearchRequest,
): Promise<PolyDeskGeneralResearchResult> {
  const apiKey = process.env.ZEROSCOUT_GENERAL_SEARCH_API_KEY?.trim() || '';
  if (!config.computeApiKey) throw new Error('0G Compute Router is not configured.');
  if (!apiKey) throw new Error('ZeroScout general search retrieval is not configured.');

  const model = config.computeGeneralResearchModel.trim() || DEFAULT_MODEL;
  const baseUrl = process.env.ZEROSCOUT_GENERAL_SEARCH_BASE_URL?.trim() || DEFAULT_SEARCH_BASE_URL;
  const cacheKey = input.market.conditionId.toLowerCase() + '|' + cleanText(input.query, 180).toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const searchQueries = await planQueriesWith0g(input, model);
  const batches = await Promise.all(searchQueries.map((query) => searchTavily(query, apiKey, baseUrl)));
  const byUrl = new Map<string, z.infer<typeof tavilyResultSchema>>();
  for (const candidate of batches.flat()) {
    if (!/^https?:\/\//i.test(candidate.url)) continue;
    const key = candidate.url.toLowerCase();
    const prior = byUrl.get(key);
    if (!prior || candidate.score > prior.score) byUrl.set(key, candidate);
  }
  const articles = [...byUrl.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((candidate) => ({
      title: cleanText(candidate.title, 500) || sourceHost(candidate.url) || 'Retrieved web source',
      description: cleanText(candidate.raw_content || candidate.content, 1_500),
      source: sourceHost(candidate.url) || 'Web source',
      url: candidate.url,
      publishedAt: cleanText(candidate.published_date || '', 80),
    }))
    .filter((article) => article.description.length > 0);
  if (!articles.length) throw new Error('ZeroScout general search returned no usable cited sources.');

  const result: PolyDeskGeneralResearchResult = {
    articles,
    model,
    searchQueries,
    computeProvider: '0G Compute Router',
    retrievalProvider: 'Tavily Search',
  };
  const cacheMs = Math.max(60_000, Number(process.env.ZEROSCOUT_GENERAL_RESEARCH_CACHE_MS || DEFAULT_CACHE_MS));
  cache.set(cacheKey, { expiresAt: Date.now() + cacheMs, result });
  return result;
}
