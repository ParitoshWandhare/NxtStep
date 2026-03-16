// ============================================================
// NxtStep — News Engine Module
// Ingestion (RSS + GNews + NewsAPI) + hybrid scoring + feed
// Score = 0.6 * contentScore + 0.2 * popularity + 0.2 * collabScore
// ============================================================

import axios from 'axios';
import * as RSSParser from 'rss-parser';
import { NewsArticle, NewsEvent } from '../models/News';
import { safeRedisGet, safeRedisSet } from '../config/redis';
import { logger } from '../utils/logger';
import { env } from '../config/env';

const rssParser = new (RSSParser as any).default();

export type NewsCategory = 'tech' | 'business' | 'finance' | 'ai' | 'startups';

// ── RSS feed definitions ──────────────────────────────────────
const RSS_FEEDS: { url: string; category: NewsCategory; source: string }[] = [
  { url: 'https://feeds.feedburner.com/TechCrunch', category: 'tech', source: 'TechCrunch' },
  { url: 'https://www.wired.com/feed/rss', category: 'tech', source: 'Wired' },
  { url: 'https://techcrunch.com/tag/artificial-intelligence/feed/', category: 'ai', source: 'TechCrunch AI' },
  { url: 'https://www.theverge.com/rss/index.xml', category: 'tech', source: 'The Verge' },
  { url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml', category: 'finance', source: 'WSJ Markets' },
  { url: 'https://hnrss.org/frontpage', category: 'tech', source: 'Hacker News' },
];

// ── Article upsert (idempotent) ───────────────────────────────
const upsertArticle = async (article: {
  title: string;
  url: string;
  source: string;
  publishedAt: Date;
  category: NewsCategory;
  summary?: string;
  imageUrl?: string;
  tags?: string[];
}): Promise<boolean> => {
  try {
    const result = await NewsArticle.updateOne(
      { url: article.url },
      { $setOnInsert: { ...article, globalClickCount: 0 } },
      { upsert: true }
    );
    return result.upsertedCount > 0;
  } catch (err: any) {
    if (err.code !== 11000) logger.warn({ err, url: article.url }, 'Article upsert failed');
    return false;
  }
};

// ── RSS Ingestion ─────────────────────────────────────────────
export const ingestRSS = async (): Promise<number> => {
  let count = 0;
  for (const feed of RSS_FEEDS) {
    try {
      const parsed = await rssParser.parseURL(feed.url);
      for (const item of (parsed.items ?? []).slice(0, 25)) {
        if (!item.link || !item.title) continue;
        const inserted = await upsertArticle({
          title: item.title,
          url: item.link,
          source: feed.source,
          publishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
          category: feed.category,
          summary: item.contentSnippet?.slice(0, 500),
          imageUrl: (item as any).enclosure?.url,
          tags: [],
        });
        if (inserted) count++;
      }
      logger.debug({ feed: feed.source, count }, 'RSS feed processed');
    } catch (err) {
      logger.warn({ err, feed: feed.url }, 'RSS feed failed — skipping');
    }
  }
  return count;
};

// ── GNews Ingestion ───────────────────────────────────────────
export const ingestGNews = async (): Promise<number> => {
  if (!env.GNEWS_API_KEY) return 0;
  let count = 0;

  const queries: { q: string; category: NewsCategory }[] = [
    { q: 'artificial intelligence machine learning LLM', category: 'ai' },
    { q: 'startup funding venture capital series', category: 'startups' },
    { q: 'software engineering developer tools', category: 'tech' },
    { q: 'stock market earnings finance', category: 'finance' },
  ];

  for (const query of queries) {
    try {
      const { data } = await axios.get('https://gnews.io/api/v4/search', {
        params: { q: query.q, lang: 'en', max: 10, apikey: env.GNEWS_API_KEY, sortby: 'publishedAt' },
        timeout: 10_000,
      });
      for (const a of data.articles ?? []) {
        const inserted = await upsertArticle({
          title: a.title, url: a.url, source: a.source?.name ?? 'GNews',
          publishedAt: new Date(a.publishedAt), category: query.category,
          summary: a.description?.slice(0, 500), imageUrl: a.image,
        });
        if (inserted) count++;
      }
    } catch (err) {
      logger.warn({ err, query: query.q }, 'GNews query failed');
    }
  }
  return count;
};

// ── NewsAPI Ingestion ─────────────────────────────────────────
export const ingestNewsAPI = async (): Promise<number> => {
  if (!env.NEWS_API_KEY) return 0;
  let count = 0;

  try {
    const { data } = await axios.get('https://newsapi.org/v2/top-headlines', {
      params: { category: 'technology', language: 'en', pageSize: 30, apiKey: env.NEWS_API_KEY },
      timeout: 10_000,
    });
    for (const a of data.articles ?? []) {
      if (!a.url || a.url.includes('[Removed]') || !a.title) continue;
      const inserted = await upsertArticle({
        title: a.title, url: a.url, source: a.source?.name ?? 'NewsAPI',
        publishedAt: new Date(a.publishedAt), category: 'tech',
        summary: a.description?.slice(0, 500), imageUrl: a.urlToImage,
      });
      if (inserted) count++;
    }
  } catch (err) {
    logger.warn({ err }, 'NewsAPI ingestion failed');
  }
  return count;
};

// ── Full ingestion run ────────────────────────────────────────
export const runIngestion = async () => {
  logger.info('News ingestion started');
  const [rss, gnews, napi] = await Promise.all([ingestRSS(), ingestGNews(), ingestNewsAPI()]);
  const total = rss + gnews + napi;
  logger.info({ rss, gnews, napi, total }, 'News ingestion complete');
  return { rss, gnews, napi, total };
};

// ── Scoring ───────────────────────────────────────────────────
const recencyScore = (publishedAt: Date): number => {
  const ageHours = (Date.now() - publishedAt.getTime()) / 3_600_000;
  return Math.max(0, 1 - ageHours / 168); // decays to 0 over 7 days
};

const categoryBoost = (category: NewsCategory): number =>
  ['ai', 'tech'].includes(category) ? 0.15 : 0;

const contentScore = (article: any): number =>
  Math.min(recencyScore(article.publishedAt) + categoryBoost(article.category), 1);

const popularityScore = (article: any): number =>
  Math.min(article.globalClickCount / 1000, 1);

const hybridScore = (article: any, collab = 0.5): number =>
  0.6 * contentScore(article) + 0.2 * popularityScore(article) + 0.2 * collab;

// ── Get personalized news feed ────────────────────────────────
export const getFeed = async (params: {
  userId?: string;
  category: string;
  page: number;
  limit: number;
}) => {
  const { userId, category, page, limit } = params;
  const cacheKey = `news:feed:${category}:${page}:${limit}`;

  // Serve from cache for anonymous users
  if (!userId) {
    const cached = await safeRedisGet(cacheKey);
    if (cached) return JSON.parse(cached);
  }

  const filter: Record<string, any> = {};
  if (category !== 'all') filter.category = category;

  // Fetch 3x limit, score and sort, then paginate
  const articles = await NewsArticle.find(filter)
    .sort({ publishedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit * 3)
    .lean();

  const scored = articles
    .map((a) => ({ ...a, _score: hybridScore(a) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(({ _score, ...a }) => a);

  const total = await NewsArticle.countDocuments(filter);
  const result = { articles: scored, total, page, pages: Math.ceil(total / limit) };

  await safeRedisSet(cacheKey, JSON.stringify(result), 120);
  return result;
};

// ── Trending articles ─────────────────────────────────────────
export const getTrending = async (limit = 10) => {
  const cacheKey = `news:trending:${limit}`;
  const cached = await safeRedisGet(cacheKey);
  if (cached) return JSON.parse(cached);

  const since = new Date(Date.now() - 24 * 3_600_000);
  const articles = await NewsArticle.find({ publishedAt: { $gte: since } })
    .sort({ globalClickCount: -1 })
    .limit(limit)
    .lean();

  await safeRedisSet(cacheKey, JSON.stringify(articles), 300);
  return articles;
};

// ── Record user interaction (click / save / share / dismiss) ──
export const recordInteraction = async (
  userId: string,
  articleId: string,
  action: 'click' | 'save' | 'share' | 'dismiss'
) => {
  await NewsEvent.create({ userId, articleId, action });

  if (['click', 'save', 'share'].includes(action)) {
    await NewsArticle.updateOne({ _id: articleId }, { $inc: { globalClickCount: 1 } });
  }

  return { recorded: true };
};
