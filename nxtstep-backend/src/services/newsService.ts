// ============================================================
// NxtStep — News Service
// ============================================================

import { NewsArticle, NewsEvent } from '../models/News';
import { safeRedisGet, safeRedisSet } from '../config/redis';
import { logger } from '../utils/logger';

const NEWS_CACHE_TTL = 120; // 2 minutes

// ── Scoring ──────────────────────────────────────────────────
const computeContentScore = (article: any, userId?: string): number => {
  // Recency: decay over 7 days
  const ageHours = (Date.now() - new Date(article.publishedAt).getTime()) / 3_600_000;
  const recencyScore = Math.max(0, 1 - ageHours / 168);

  // Tag relevance: tech/ai gets higher base
  const premiumCategories = ['ai', 'tech'];
  const categoryBoost = premiumCategories.includes(article.category) ? 0.2 : 0;

  return Math.min(recencyScore + categoryBoost, 1);
};

const computePopularityScore = (article: any): number =>
  Math.min(article.globalClickCount / 1000, 1);

const hybridScore = (contentScore: number, popularity: number, collab = 0.5): number =>
  0.6 * contentScore + 0.2 * popularity + 0.2 * collab;

// ── Get personalized feed ────────────────────────────────────
export const getNewsFeed = async (
  userId: string | undefined,
  category: string,
  page: number,
  limit: number
) => {
  const cacheKey = `news:feed:${category}:${page}:${limit}`;
  const cached = await safeRedisGet(cacheKey);
  if (cached && !userId) return JSON.parse(cached);

  const filter: Record<string, any> = {};
  if (category !== 'all') filter.category = category;

  const articles = await NewsArticle.find(filter)
    .sort({ publishedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit * 3) // Fetch more, then re-rank
    .lean();

  // Score and sort
  const scored = articles.map((a) => ({
    ...a,
    _score: hybridScore(computeContentScore(a, userId), computePopularityScore(a)),
  }));

  scored.sort((a, b) => b._score - a._score);
  const paginated = scored.slice(0, limit).map(({ _score, ...a }) => a);

  const total = await NewsArticle.countDocuments(filter);

  const result = { articles: paginated, total, page, pages: Math.ceil(total / limit) };
  await safeRedisSet(cacheKey, JSON.stringify(result), NEWS_CACHE_TTL);
  return result;
};

// ── Record feedback ──────────────────────────────────────────
export const recordNewsFeedback = async (
  userId: string,
  articleId: string,
  action: 'click' | 'save' | 'share' | 'dismiss'
) => {
  await NewsEvent.create({ userId, articleId, action });

  if (action === 'click' || action === 'save' || action === 'share') {
    await NewsArticle.updateOne({ _id: articleId }, { $inc: { globalClickCount: 1 } });
  }

  logger.debug({ userId, articleId, action }, 'News feedback recorded');
  return { recorded: true };
};

// ── Trending ─────────────────────────────────────────────────
export const getTrendingArticles = async (limit = 10) => {
  const cacheKey = `news:trending:${limit}`;
  const cached = await safeRedisGet(cacheKey);
  if (cached) return JSON.parse(cached);

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h
  const trending = await NewsArticle.find({ publishedAt: { $gte: cutoff } })
    .sort({ globalClickCount: -1 })
    .limit(limit)
    .lean();

  await safeRedisSet(cacheKey, JSON.stringify(trending), 300);
  return trending;
};
