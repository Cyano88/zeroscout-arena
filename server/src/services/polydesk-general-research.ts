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

type ProviderArticle = Record<string, unknown>;

function stringValue(value: unknown, max = 2_000): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function queryValue(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function normalizeArticle(value: ProviderArticle): PolyDeskGeneralResearchArticle | null {
  const title = stringValue(value.title, 500);
  const description = stringValue(value.description ?? value.content, 2_000);
  const url = stringValue(value.url, 2_000);
  const publishedAt = stringValue(value.publishedAt ?? value.published_at, 100);
  const sourceRecord = value.source && typeof value.source === 'object' && !Array.isArray(value.source)
    ? value.source as Record<string, unknown>
    : {};
  const source = stringValue(sourceRecord.name ?? value.source, 200) || 'General news source';
  if (!title || !description || !/^https?:\/\//i.test(url)) return null;
  return { title, description, source, url, publishedAt };
}

export function polyDeskGeneralResearchConfigured(): boolean {
  return Boolean(
    process.env.ZEROSCOUT_GENERAL_RESEARCH_API_KEY?.trim()
    || process.env.ZEROSCOUT_GENERAL_RESEARCH_URL?.trim(),
  );
}

export async function fetchPolyDeskGeneralResearch(
  input: PolyDeskGeneralResearchRequest,
): Promise<PolyDeskGeneralResearchArticle[]> {
  const apiKey = process.env.ZEROSCOUT_GENERAL_RESEARCH_API_KEY?.trim() || '';
  const configuredUrl = process.env.ZEROSCOUT_GENERAL_RESEARCH_URL?.trim() || '';
  if (!apiKey && !configuredUrl) {
    throw new Error('ZeroScout general research is not configured.');
  }

  const url = new URL(configuredUrl || 'https://gnews.io/api/v4/search');
  if (!url.searchParams.has('q')) url.searchParams.set('q', queryValue(input.query));
  if (!url.searchParams.has('max')) url.searchParams.set('max', '10');
  if (!url.searchParams.has('lang')) url.searchParams.set('lang', 'en');
  if (apiKey && !url.searchParams.has('apikey') && !url.searchParams.has('token')) {
    url.searchParams.set('apikey', apiKey);
  }

  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'ZeroScout-PolyDesk-Research' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    throw new Error('ZeroScout general research provider returned ' + response.status + '.');
  }
  const body = await response.json() as Record<string, unknown>;
  const candidates = [body.articles, body.items, body.results, body.data]
    .find(Array.isArray) as ProviderArticle[] | undefined;
  const seen = new Set<string>();
  return (candidates ?? [])
    .map(normalizeArticle)
    .filter((article): article is PolyDeskGeneralResearchArticle => Boolean(article))
    .filter((article) => {
      const key = (article.url + '|' + article.title).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}
