import axios from 'axios';
import RSSParser from 'rss-parser';
import mongoose from 'mongoose';
import { NewsArticle, INewsArticle, NewsCategory } from '../models/NewsArticle';
import { NewsEvent } from '../models/NewsEvent';
import { User } from '../models/User';
import { redisClient } from '../config/redis';
import { env } from '../config/env';
import { logger } from '../utils/logger';

// ─── Lean type (replaces `as unknown as INewsArticle[]` casts) ────────────────
// .lean() returns plain JS objects, not Mongoose Documents.
// This type accurately reflects what lean() actually returns.
type LeanNewsArticle = {
  _id: mongoose.Types.ObjectId;
  title: string;
  url: string;
  source: string;
  publishedAt: Date;
  category: NewsCategory;
  summary: string;
  tags: string[];
  imageUrl?: string;
  globalClickCount: number;
  createdAt: Date;
};

const rssParser = new RSSParser();

// ─── RSS feed sources ─────────────────────────────────────────────────────────
const RSS_FEEDS: Array<{ url: string; category: NewsCategory; source: string }> = [
  { url: 'https://feeds.feedburner.com/TechCrunch',                              category: 'tech',     source: 'TechCrunch'    },
  { url: 'https://www.theverge.com/rss/index.xml',                               category: 'tech',     source: 'The Verge'     },
  { url: 'https://hnrss.org/frontpage',                                           category: 'tech',     source: 'Hacker News'   },
  { url: 'https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml',                      category: 'business', source: 'WSJ Business'  },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml',          category: 'tech',     source: 'NYT Tech'      },
  { url: 'https://venturebeat.com/feed/',                                         category: 'ai',       source: 'VentureBeat'   },
  { url: 'https://techcrunch.com/category/artificial-intelligence/feed/',         category: 'ai',       source: 'TechCrunch AI' },
  { url: 'https://news.ycombinator.com/rss',                                      category: 'startups', source: 'Hacker News'   },
];

const CATEGORY_KEYWORDS: Record<NewsCategory, string[]> = {
  tech:     ['software', 'developer', 'programming', 'code', 'app', 'tech', 'digital'],
  ai:       ['ai', 'artificial intelligence', 'machine learning', 'llm', 'gpt', 'neural', 'deep learning'],
  business: ['business', 'company', 'revenue', 'market', 'enterprise', 'corporate'],
  finance:  ['finance', 'stock', 'investment', 'crypto', 'funding', 'ipo', 'valuation'],
  startups: ['startup', 'founder', 'venture', 'seed', 'series a', 'launch', 'pivot'],
};

// ─── News ingestion ───────────────────────────────────────────────────────────

export const ingestNews = async (): Promise<{ inserted: number; skipped: number }> => {
  let inserted = 0;
  let skipped  = 0;

  for (const feed of RSS_FEEDS) {
    try {
      const parsed = await rssParser.parseURL(feed.url);

      for (const item of parsed.items.slice(0, 20)) {
        if (!item.title || !item.link) continue;

        const tags = extractTags(item.title + ' ' + (item.contentSnippet || ''), feed.category);

        try {
          await NewsArticle.create({
            title:      item.title.trim(),
            url:        item.link,
            source:     feed.source,
            publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
            category:   feed.category,
            summary:    item.contentSnippet?.slice(0, 300) || '',
            tags,
            imageUrl:   extractImageFromContent(item['content:encoded'] || item.content || ''),
          });
          inserted++;
        } catch (err: unknown) {
          // Duplicate URL — expected, skip silently
          if ((err as { code?: number }).code === 11000) {
            skipped++;
          }
        }
      }
    } catch (err) {
      logger.warn(`Failed to fetch RSS feed ${feed.url}:`, err);
    }
  }

  // Also try NewsAPI if key is available
  if (env.NEWSAPI_KEY) {
    const newsApiResult = await ingestFromNewsAPI();
    inserted += newsApiResult.inserted;
    skipped  += newsApiResult.skipped;
  }

  logger.info(`News ingestion complete: inserted=${inserted} skipped=${skipped}`);
  return { inserted, skipped };
};

const ingestFromNewsAPI = async (): Promise<{ inserted: number; skipped: number }> => {
  let inserted = 0;
  let skipped  = 0;

  const categories: Array<{ q: string; category: NewsCategory }> = [
    { q: 'artificial intelligence', category: 'ai'       },
    { q: 'tech startups',           category: 'startups' },
  ];

  for (const { q, category } of categories) {
    try {
      const res = await axios.get('https://newsapi.org/v2/everything', {
        params:  { q, language: 'en', sortBy: 'publishedAt', pageSize: 10, apiKey: env.NEWSAPI_KEY },
        timeout: 10000,
      });

      for (const article of res.data.articles || []) {
        if (!article.title || !article.url) continue;
        try {
          await NewsArticle.create({
            title:      article.title,
            url:        article.url,
            source:     article.source?.name || 'NewsAPI',
            publishedAt: new Date(article.publishedAt),
            category,
            summary:    article.description || '',
            tags:       extractTags(article.title + ' ' + (article.description || ''), category),
            imageUrl:   article.urlToImage,
          });
          inserted++;
        } catch (err: unknown) {
          if ((err as { code?: number }).code === 11000) skipped++;
        }
      }
    } catch (err) {
      logger.warn('NewsAPI ingestion error:', err);
    }
  }

  return { inserted, skipped };
};

// ─── Personalized news feed ───────────────────────────────────────────────────

export const getPersonalizedNews = async (params: {
  userId?:     string;
  category?:   string;
  limit:       number;
  cursor?:     string;
  personalize?: boolean;
// Return LeanNewsArticle[] — callers should not call Document methods on these
}): Promise<{ articles: LeanNewsArticle[]; nextCursor?: string }> => {
  const { userId, category, limit, cursor, personalize = true } = params;

  // Try cache for non-personalized requests
  if (!userId || !personalize) {
    const cacheKey = `news:${category || 'all'}:${cursor || 'start'}:${limit}`;
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {
      // Redis unavailable — continue to DB
    }
  }

  const query: Record<string, unknown> = {};
  if (category && category !== 'all') query.category = category;
  // cursor is a stringified ObjectId — compare as ObjectId for correct sort order
  if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
    query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
  }

  // Fetch a larger batch when personalizing so re-ranking has enough candidates
  const fetchLimit = personalize && userId ? limit * 3 : limit;

  // .lean<LeanNewsArticle[]>() — typed lean query, no cast needed
  const articles = await NewsArticle.find(query)
    .sort({ publishedAt: -1 })
    .limit(fetchLimit)
    .lean<LeanNewsArticle[]>();

  let rankedArticles: LeanNewsArticle[] = articles;

  if (userId && personalize && articles.length > 0) {
    const user = await User.findById(userId).lean();
    if (user) {
      const interestVector = buildInterestVector(user.interests || [], user.rolePreferences || []);
      rankedArticles       = rankArticles(articles, interestVector);
    }
  }

  const paginated  = rankedArticles.slice(0, limit);
  const nextCursor = paginated.length === limit
    ? paginated[paginated.length - 1]._id.toString()
    : undefined;

  const result = { articles: paginated, nextCursor };

  // Cache non-personalized results for 2 minutes
  if (!userId || !personalize) {
    const cacheKey = `news:${category || 'all'}:${cursor || 'start'}:${limit}`;
    try {
      await redisClient.setEx(cacheKey, 120, JSON.stringify(result));
    } catch {
      // Redis unavailable — skip cache write
    }
  }

  return result;
};

// ─── Feedback recording ───────────────────────────────────────────────────────

export const recordFeedback = async (params: {
  userId:    string;
  articleId: string;
  action:    'click' | 'save' | 'share' | 'dismiss';
}): Promise<void> => {
  await NewsEvent.create({ ...params, timestamp: new Date() });

  if (params.action === 'click') {
    await NewsArticle.findByIdAndUpdate(params.articleId, { $inc: { globalClickCount: 1 } });
  }
};

// ─── Trending articles ────────────────────────────────────────────────────────

export const getTrending = async (limit = 10): Promise<LeanNewsArticle[]> => {
  const cacheKey = 'news:trending';

  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached) as LeanNewsArticle[];
  } catch {
    // Redis unavailable — continue to DB
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24 hours

  // .lean<LeanNewsArticle[]>() — typed, no cast needed
  const articles = await NewsArticle.find({ publishedAt: { $gte: since } })
    .sort({ globalClickCount: -1 })
    .limit(limit)
    .lean<LeanNewsArticle[]>();

  try {
    await redisClient.setEx(cacheKey, 300, JSON.stringify(articles)); // 5 min cache
  } catch {
    // Redis unavailable — skip cache write
  }

  return articles;
};

// ─── Private helpers ──────────────────────────────────────────────────────────

const buildInterestVector = (
  interests:   string[],
  preferences: string[],
): Record<string, number> => {
  const vector: Record<string, number> = {};
  [...interests, ...preferences].forEach(item => {
    const key    = item.toLowerCase();
    vector[key]  = (vector[key] || 0) + 1;
  });
  return vector;
};

// Accepts and returns LeanNewsArticle[] — no Document methods used internally
const rankArticles = (
  articles:       LeanNewsArticle[],
  interestVector: Record<string, number>,
): LeanNewsArticle[] => {
  const now    = Date.now();
  const lambda = 0.02; // exponential decay constant (per hour)

  return articles
    .map(article => {
      const hoursSince       = (now - new Date(article.publishedAt).getTime()) / 3_600_000;
      const recency          = Math.exp(-lambda * hoursSince);
      const popularity       = Math.min(article.globalClickCount / 100, 1);

      const tagScore         = article.tags.reduce((acc, tag) =>
        acc + (interestVector[tag.toLowerCase()] || 0), 0,
      );
      const normalizedTag    = Math.min(tagScore / 5, 1);

      const finalScore       = 0.6 * normalizedTag + 0.3 * recency + 0.1 * popularity;
      return { article, score: finalScore };
    })
    .sort((a, b) => b.score - a.score)
    .map(item => item.article);
};

const extractTags = (text: string, category: NewsCategory): string[] => {
  const tags  = new Set<string>([category]);
  const lower = text.toLowerCase();

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) tags.add(cat);
  }

  const techTerms = [
    'react', 'node', 'python', 'typescript', 'javascript',
    'kubernetes', 'docker', 'aws', 'gpt', 'llm', 'openai',
    'startup', 'ipo', 'funding', 'developer',
  ];
  techTerms.forEach(term => {
    if (lower.includes(term)) tags.add(term);
  });

  return [...tags].slice(0, 10);
};

const extractImageFromContent = (content: string): string | undefined => {
  const match = content.match(/<img[^>]+src="([^">]+)"/);
  return match ? match[1] : undefined;
};