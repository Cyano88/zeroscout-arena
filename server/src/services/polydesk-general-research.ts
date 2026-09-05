import { z } from 'zod';
import { config } from '../config.js';

export const polyDeskGeneralResearchRequestSchema = z.object({
  schema: z.literal('zeroscout.polydesk-general-research.request'),
  schemaVersion: z.literal('1.0.0'),
  query: z.string().trim().min(2).max(180),
  requestedOutcome: z.string().trim().min(1).max(120).optional(),
  requestedSide: z.enum(['BUY', 'SELL']).optional(),
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
  retrievedAt: string;
  evidenceRole: 'RESOLUTION_AUTHORITY' | 'EXTERNAL_SOURCE';
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
  queries: z.array(z.union([
    z.string().trim().min(3).max(300),
    z.object({
      role: z.enum(['RESOLUTION_AUTHORITY', 'CURRENT_CONFIRMING', 'CURRENT_CONTRADICTORY']),
      query: z.string().trim().min(3).max(300),
    }).strict(),
  ])).min(2).max(3),
}).strict();

type ResearchQueryRole = 'RESOLUTION_AUTHORITY' | 'CURRENT_CONFIRMING' | 'CURRENT_CONTRADICTORY';
type ResearchQuery = { role: ResearchQueryRole; query: string };

const RESEARCH_QUERY_ROLES: ResearchQueryRole[] = [
  'RESOLUTION_AUTHORITY',
  'CURRENT_CONFIRMING',
  'CURRENT_CONTRADICTORY',
];

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

type RankedCandidate = z.infer<typeof tavilyResultSchema> & { queryRole: ResearchQueryRole };

function cleanText(value: string, max = 500): string {
  const withoutControls = Array.from(value, (character) => {
    const code = character.codePointAt(0) || 0;
    return code <= 0x1f || code === 0x7f ? ' ' : character;
  }).join('');
  return withoutControls
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

function isExcludedEvidenceUrl(url: string, resolutionSource: string | undefined): boolean {
  const host = sourceHost(url).toLowerCase();
  const resolutionHost = sourceHost(resolutionSource).toLowerCase();
  if (resolutionHost && host === resolutionHost) return false;
  const excludedHosts = [
    'facebook.com',
    'instagram.com',
    'polymarket.com',
    'reddit.com',
    'tiktok.com',
    'twitter.com',
    'x.com',
    'youtube.com',
  ];
  return excludedHosts.some((excluded) => host === excluded || host.endsWith('.' + excluded));
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

function deterministicResearchQueries(input: PolyDeskGeneralResearchRequest): ResearchQuery[] {
  const seeds = buildPolyDeskResearchQueries(input);
  return [
    { role: 'RESOLUTION_AUTHORITY', query: seeds[1] || seeds[0] },
    { role: 'CURRENT_CONFIRMING', query: seeds[0] || seeds[1] },
    { role: 'CURRENT_CONTRADICTORY', query: seeds[2] || seeds[0] },
  ].filter((entry): entry is ResearchQuery => Boolean(entry.query));
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
): Promise<ResearchQuery[]> {
  if (!config.computeApiKey) throw new Error('0G Compute Router is not configured.');
  const seeds = buildPolyDeskResearchQueries(input);
  const prompt = [
    'Create 2 to 3 precise web-search queries for evidence about this prediction market.',
    'Return JSON only: {"queries":["..."]}. Do not answer the market and do not invent URLs.',
    'Queries must cover: the official resolution authority, the newest confirming evidence, and credible contradictory evidence.',
    'Return queries in exactly that order: resolution authority, current confirming evidence, current contradictory evidence.',
    'Use distinctive entities, dates, thresholds, event names, and resolution keywords from the complete rules.',
    'Research request: ' + input.query,
    input.requestedOutcome && input.requestedSide
      ? 'Requested trade: ' + input.requestedSide + ' ' + input.requestedOutcome + '. Confirming evidence must support this exact trade; contradictory evidence must cut against it.'
      : '',
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
  const fallbacks = deterministicResearchQueries(input);
  const planned = plan.queries.map((entry, index): ResearchQuery => typeof entry === 'string'
    ? { role: RESEARCH_QUERY_ROLES[index] || 'CURRENT_CONFIRMING', query: cleanText(entry, 300) }
    : { role: entry.role, query: cleanText(entry.query, 300) });
  const byRole = new Map<ResearchQueryRole, ResearchQuery>();
  for (const entry of [...planned, ...fallbacks]) {
    if (entry.query && !byRole.has(entry.role)) byRole.set(entry.role, entry);
  }
  return RESEARCH_QUERY_ROLES.flatMap((role) => byRole.get(role) ? [byRole.get(role)!] : []);
}

async function searchTavily(query: ResearchQuery, apiKey: string, baseUrl: string) {
  const response = await fetch(baseUrl.replace(/\/+$/, '') + '/search', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: query.query,
      search_depth: 'advanced',
      topic: query.role === 'RESOLUTION_AUTHORITY' ? 'general' : 'news',
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

function hasPublicationDate(candidate: z.infer<typeof tavilyResultSchema>): boolean {
  return Boolean(candidate.published_date && Number.isFinite(Date.parse(candidate.published_date)));
}

function rankRoleCandidates(candidates: RankedCandidate[], role: ResearchQueryRole, resolutionHost: string) {
  return [...candidates].sort((a, b) => {
    if (role === 'RESOLUTION_AUTHORITY' && resolutionHost) {
      const aAuthority = sourceHost(a.url).toLowerCase() === resolutionHost ? 1 : 0;
      const bAuthority = sourceHost(b.url).toLowerCase() === resolutionHost ? 1 : 0;
      if (aAuthority !== bAuthority) return bAuthority - aAuthority;
    }
    if (role !== 'RESOLUTION_AUTHORITY') {
      const aDated = hasPublicationDate(a) ? 1 : 0;
      const bDated = hasPublicationDate(b) ? 1 : 0;
      if (aDated !== bDated) return bDated - aDated;
    }
    return b.score - a.score;
  });
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
  const cacheKey = [
    input.market.conditionId.toLowerCase(),
    cleanText(input.query, 180).toLowerCase(),
    input.requestedSide || '',
    cleanText(input.requestedOutcome || '', 120).toLowerCase(),
  ].join('|');
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const searchQueries = await planQueriesWith0g(input, model);
  const batches = await Promise.all(searchQueries.map(async (query) => ({
    query,
    results: await searchTavily(query, apiKey, baseUrl),
  })));
  const candidates: RankedCandidate[] = [];
  for (const batch of batches) {
    for (const candidate of batch.results) {
      if (isExcludedEvidenceUrl(candidate.url, input.market.resolutionSource)) continue;
      if (!/^https?:\/\//i.test(candidate.url)) continue;
      candidates.push({ ...candidate, queryRole: batch.query.role });
    }
  }
  const retrievedAt = new Date().toISOString();
  const resolutionHost = sourceHost(input.market.resolutionSource).toLowerCase();
  const selected: RankedCandidate[] = [];
  const selectedUrls = new Set<string>();
  for (const role of RESEARCH_QUERY_ROLES) {
    const candidate = rankRoleCandidates(candidates.filter((entry) => entry.queryRole === role), role, resolutionHost)
      .find((entry) => !selectedUrls.has(entry.url.toLowerCase()));
    if (!candidate) continue;
    selected.push(candidate);
    selectedUrls.add(candidate.url.toLowerCase());
  }
  for (const candidate of [...candidates].sort((a, b) => b.score - a.score)) {
    if (selected.length >= 8) break;
    const key = candidate.url.toLowerCase();
    if (selectedUrls.has(key)) continue;
    selected.push(candidate);
    selectedUrls.add(key);
  }
  const articles = selected
    .map((candidate) => ({
      title: cleanText(candidate.title, 500) || sourceHost(candidate.url) || 'Retrieved web source',
      description: cleanText(candidate.raw_content || candidate.content, 1_500),
      source: sourceHost(candidate.url) || 'Web source',
      url: candidate.url,
      publishedAt: cleanText(candidate.published_date || '', 80),
      retrievedAt,
      evidenceRole: resolutionHost && sourceHost(candidate.url).toLowerCase() === resolutionHost
        ? 'RESOLUTION_AUTHORITY' as const
        : 'EXTERNAL_SOURCE' as const,
    }))
    .filter((article) => article.description.length > 0);
  if (!articles.length) throw new Error('ZeroScout general search returned no usable cited sources.');

  const result: PolyDeskGeneralResearchResult = {
    articles,
    model,
    searchQueries: searchQueries.map((entry) => entry.query),
    computeProvider: '0G Compute Router',
    retrievalProvider: 'Tavily Search',
  };
  const cacheMs = Math.max(60_000, Number(process.env.ZEROSCOUT_GENERAL_RESEARCH_CACHE_MS || DEFAULT_CACHE_MS));
  cache.set(cacheKey, { expiresAt: Date.now() + cacheMs, result });
  return result;
}
