import { z } from 'zod';

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
};

type Citation = {
  title: string;
  url: string;
  startIndex?: number;
  endIndex?: number;
};

type CacheEntry = { expiresAt: number; result: PolyDeskGeneralResearchResult };

const cache = new Map<string, CacheEntry>();
const DEFAULT_MODEL = 'gpt-5.6';
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_CACHE_MS = 10 * 60 * 1000;

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

function responseText(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === 'string') return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  return output.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? (item as Record<string, unknown>).content as Array<Record<string, unknown>>
      : [];
    return content.map((entry) => typeof entry.text === 'string' ? entry.text : '');
  }).filter(Boolean).join('\n');
}

function responseSearchQueries(payload: Record<string, unknown>, fallback: string[]): string[] {
  const output = Array.isArray(payload.output) ? payload.output : [];
  const queries = output.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (record.type !== 'web_search_call' || !record.action || typeof record.action !== 'object') return [];
    const action = record.action as Record<string, unknown>;
    if (Array.isArray(action.queries)) return action.queries.filter((value): value is string => typeof value === 'string');
    return typeof action.query === 'string' ? [action.query] : [];
  });
  return [...new Set((queries.length ? queries : fallback).map((value) => cleanText(value, 300)).filter(Boolean))];
}

function responseCitations(payload: Record<string, unknown>): Citation[] {
  const output = Array.isArray(payload.output) ? payload.output : [];
  const citations: Citation[] = [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? (item as Record<string, unknown>).content as Array<Record<string, unknown>>
      : [];
    for (const entry of content) {
      const annotations = Array.isArray(entry.annotations) ? entry.annotations : [];
      for (const annotationValue of annotations) {
        if (!annotationValue || typeof annotationValue !== 'object') continue;
        const annotation = annotationValue as Record<string, unknown>;
        const nested = annotation.url_citation && typeof annotation.url_citation === 'object'
          ? annotation.url_citation as Record<string, unknown>
          : annotation;
        const url = typeof nested.url === 'string' ? nested.url.trim() : '';
        if (annotation.type !== 'url_citation' || !/^https?:\/\//i.test(url)) continue;
        citations.push({
          title: typeof nested.title === 'string' ? cleanText(nested.title, 500) : '',
          url,
          startIndex: typeof nested.start_index === 'number' ? nested.start_index : undefined,
          endIndex: typeof nested.end_index === 'number' ? nested.end_index : undefined,
        });
      }
    }
  }
  return citations;
}

function citationDescription(citation: Citation, text: string, question: string): string {
  if (citation.startIndex !== undefined && citation.endIndex !== undefined) {
    const start = Math.max(0, citation.startIndex - 220);
    const end = Math.min(text.length, citation.endIndex + 120);
    const context = cleanText(text.slice(start, end), 700);
    if (context) return context;
  }
  return 'Source cited by ZeroScout agentic web research for: ' + cleanText(question, 400);
}

function articlesFromResponse(payload: Record<string, unknown>, question: string): PolyDeskGeneralResearchArticle[] {
  const text = responseText(payload);
  const seen = new Set<string>();
  return responseCitations(payload)
    .filter((citation) => {
      const key = citation.url.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((citation) => ({
      title: citation.title || sourceHost(citation.url) || 'Cited web source',
      description: citationDescription(citation, text, question),
      source: sourceHost(citation.url) || 'Web source',
      url: citation.url,
      publishedAt: '',
    }))
    .slice(0, 8);
}

export function polyDeskGeneralResearchConfigured(): boolean {
  return Boolean(process.env.ZEROSCOUT_GENERAL_RESEARCH_API_KEY?.trim());
}

export async function fetchPolyDeskGeneralResearch(
  input: PolyDeskGeneralResearchRequest,
): Promise<PolyDeskGeneralResearchResult> {
  const apiKey = process.env.ZEROSCOUT_GENERAL_RESEARCH_API_KEY?.trim() || '';
  if (!apiKey) throw new Error('ZeroScout agentic web research is not configured.');

  const model = process.env.ZEROSCOUT_GENERAL_RESEARCH_MODEL?.trim() || DEFAULT_MODEL;
  const baseUrl = (process.env.ZEROSCOUT_GENERAL_RESEARCH_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const seedQueries = buildPolyDeskResearchQueries(input);
  const cacheKey = input.market.conditionId.toLowerCase() + '|' + cleanText(input.query, 180).toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const prompt = [
    'You are ZeroScout market research. Search the live web before answering.',
    'Research this prediction market without forecasting or recommending a trade.',
    'Market question: ' + input.market.question,
    'Full resolution rules: ' + input.market.resolutionRules,
    input.market.resolutionSource ? 'Resolution source: ' + input.market.resolutionSource : '',
    'Seed search queries: ' + seedQueries.join(' | '),
    'Prioritize primary sources, official resolution authorities, reputable reporting, and recent contradictory evidence.',
    'Do not rely on memory. Every factual claim must have a web citation. Clearly separate confirmed facts from uncertainty.',
  ].filter(Boolean).join('\n');

  const response = await fetch(baseUrl + '/responses', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: 'low' },
      tools: [{ type: 'web_search' }],
      tool_choice: 'required',
      include: ['web_search_call.action.sources'],
      input: prompt,
    }),
    signal: AbortSignal.timeout(45_000),
  });
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    const error = payload.error && typeof payload.error === 'object'
      ? payload.error as Record<string, unknown>
      : {};
    const message = typeof error.message === 'string' ? cleanText(error.message, 300) : '';
    throw new Error('ZeroScout agentic web research failed with ' + response.status + (message ? ': ' + message : '.'));
  }

  const articles = articlesFromResponse(payload, input.market.question);
  if (!articles.length) throw new Error('ZeroScout agentic web research returned no cited sources.');
  const result = {
    articles,
    model,
    searchQueries: responseSearchQueries(payload, seedQueries),
  };
  const cacheMs = Math.max(60_000, Number(process.env.ZEROSCOUT_GENERAL_RESEARCH_CACHE_MS || DEFAULT_CACHE_MS));
  cache.set(cacheKey, { expiresAt: Date.now() + cacheMs, result });
  return result;
}
