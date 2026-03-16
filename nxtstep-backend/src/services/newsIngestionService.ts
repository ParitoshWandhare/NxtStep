// ============================================================
// NxtStep — News Ingestion Service
// Fetches from RSS feeds, GNews, and NewsAPI.
// ============================================================

import axios from 'axios';
import * as RSSParser from 'rss-parser';
import { NewsArticle } from '../models/News';
import { logger } from '../utils/logger';
import { env } from '../config/env';

const rssParser = new (RSSParser as any).default();

type NewsCategory = 'tech' | 'business' | 'finance' | 'ai' | 'startups';

const RSS_FEEDS: { url: string; category: NewsCategory }[] = [
  { url: 'https://feeds.feedburner.com/TechCrunch', category: 'tech' },
  { url: 'https://www.wired.com/feed/rss', category: 'tech' },
  { url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml', category: 'finance' },
  { url: 'https://techcrunch.com/tag/artificial-intelligence/feed/', category: 'ai' },
  { url: 'https://www.theverge.com/rss/index.xml', category: 'tech' },
];

const upsertArticle = async (article: {
  title: string;
  url: string;
  source: string;
  publishedAt: Date;
  category: NewsCategory;
  summary?: string;
  imageUrl?: string;
  tags?: string[];
}) => {
  try {
    await NewsArticle.updateOne(
      { url: article.url },
      { $setOnInsert: article },
      { upsert: true }
    );
  } catch (err: any) {
    if (err.code !== 11000) logger.warn({ err, url: article.url }, 'Upsert failed for article');
  }
};

// ── RSS ingestion ─────────────────────────────────────────────
const ingestRSS = async () => {
  let count = 0;
  for (const feed of RSS_FEEDS) {
    try {
      const parsed = await rssParser.parseURL(feed.url);
      const items = parsed.items?.slice(0, 20) ?? [];

      for (const item of items) {
        if (!item.link || !item.title) continue;
        await upsertArticle({
          title: item.title,
          url: item.link,
          source: parsed.title ?? new URL(feed.url).hostname,
          publishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
          category: feed.category,
          summary: item.contentSnippet?.slice(0, 500),
          imageUrl: (item as any).enclosure?.url,
          tags: [],
        });
        count++;
      }
    } catch (err) {
      logger.warn({ err, feed: feed.url }, 'RSS feed failed');
    }
  }
  return count;
};

// ── GNews ingestion ───────────────────────────────────────────
const ingestGNews = async () => {
  if (!env.GNEWS_API_KEY) return 0;
  let count = 0;

  const queries = [
    { q: 'technology OR software engineering', category: 'tech' as NewsCategory },
    { q: 'artificial intelligence machine learning', category: 'ai' as NewsCategory },
    { q: 'startup funding venture capital', category: 'startups' as NewsCategory },
  ];

  for (const query of queries) {
    try {
      const { data } = await axios.get('https://gnews.io/api/v4/search', {
        params: { q: query.q, lang: 'en', max: 10, apikey: env.GNEWS_API_KEY },
        timeout: 10000,
      });

      for (const article of data.articles ?? []) {
        await upsertArticle({
          title: article.title,
          url: article.url,
          source: article.source?.name ?? 'GNews',
          publishedAt: new Date(article.publishedAt),
          category: query.category,
          summary: article.description?.slice(0, 500),
          imageUrl: article.image,
          tags: [],
        });
        count++;
      }
    } catch (err) {
      logger.warn({ err, query: query.q }, 'GNews fetch failed');
    }
  }
  return count;
};

// ── NewsAPI ingestion ─────────────────────────────────────────
const ingestNewsAPI = async () => {
  if (!env.NEWS_API_KEY) return 0;
  let count = 0;

  try {
    const { data } = await axios.get('https://newsapi.org/v2/top-headlines', {
      params: { category: 'technology', language: 'en', pageSize: 20, apiKey: env.NEWS_API_KEY },
      timeout: 10000,
    });

    for (const article of data.articles ?? []) {
      if (!article.url || article.url.includes('[Removed]')) continue;
      await upsertArticle({
        title: article.title,
        url: article.url,
        source: article.source?.name ?? 'NewsAPI',
        publishedAt: new Date(article.publishedAt),
        category: 'tech',
        summary: article.description?.slice(0, 500),
        imageUrl: article.urlToImage,
        tags: [],
      });
      count++;
    }
  } catch (err) {
    logger.warn({ err }, 'NewsAPI fetch failed');
  }
  return count;
};

// ── Main ingestion runner ─────────────────────────────────────
export const runNewsIngestion = async () => {
  logger.info('Starting news ingestion');
  const [rssCount, gnewsCount, napiCount] = await Promise.all([
    ingestRSS(),
    ingestGNews(),
    ingestNewsAPI(),
  ]);
  const total = rssCount + gnewsCount + napiCount;
  logger.info({ rssCount, gnewsCount, napiCount, total }, 'News ingestion complete');
  return total;
};
