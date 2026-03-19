// ============================================================
// NxtStep — News Feed Page
// ============================================================

import { useState } from 'react';
import { ExternalLink, TrendingUp, Clock, Bookmark } from 'lucide-react';
import { Card, Badge, Skeleton, EmptyState } from '@/components/ui/index';
import { useNewsFeed, useTrending, useSubmitNewsFeedback } from '@/hooks/useApi';
import { usePageTitle } from '@/hooks';
import { formatRelativeTime, truncate, getCategoryIcon, cn } from '@/utils';
import type { NewsArticle, NewsCategory } from '@/types';

const CATEGORIES: { value: NewsCategory; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'tech', label: '💻 Tech' },
  { value: 'ai', label: '🤖 AI' },
  { value: 'startups', label: '🚀 Startups' },
  { value: 'business', label: '📈 Business' },
  { value: 'finance', label: '💰 Finance' },
];

function ArticleCard({ article }: { article: NewsArticle }) {
  const feedback = useSubmitNewsFeedback();

  const handleClick = () => {
    feedback.mutate({ articleId: article._id, action: 'click' });
    window.open(article.url, '_blank', 'noopener,noreferrer');
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    feedback.mutate({ articleId: article._id, action: 'save' });
  };

  return (
    <Card
      hover
      onClick={handleClick}
      className="cursor-pointer group relative overflow-hidden"
    >
      {/* Category badge */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">{getCategoryIcon(article.category)}</span>
          <Badge variant="ghost" size="sm">{article.category}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleSave}
            className="p-1.5 rounded-lg hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:text-primary-500 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Bookmark size={14} />
          </button>
          <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
            <Clock size={10} />
            {formatRelativeTime(article.publishedAt)}
          </span>
        </div>
      </div>

      {/* Image */}
      {article.imageUrl && (
        <div className="w-full h-36 rounded-xl overflow-hidden mb-3 bg-[var(--color-bg-elevated)]">
          <img
            src={article.imageUrl}
            alt={article.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}

      {/* Content */}
      <h3 className="font-display font-semibold text-sm text-[var(--color-text-primary)] leading-snug mb-2 group-hover:text-primary-500 transition-colors line-clamp-2">
        {article.title}
      </h3>

      {article.summary && (
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed line-clamp-2">
          {article.summary}
        </p>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--color-border-subtle)]">
        <span className="text-xs font-medium text-[var(--color-text-muted)]">{article.source}</span>
        <ExternalLink size={12} className="text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Card>
  );
}

function TrendingCard({ article }: { article: NewsArticle }) {
  const feedback = useSubmitNewsFeedback();

  return (
    <button
      onClick={() => {
        feedback.mutate({ articleId: article._id, action: 'click' });
        window.open(article.url, '_blank', 'noopener,noreferrer');
      }}
      className="flex items-start gap-3 p-3 rounded-xl hover:bg-[var(--color-bg-elevated)] transition-colors text-left group w-full"
    >
      <span className="text-base shrink-0 mt-0.5">{getCategoryIcon(article.category)}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--color-text-primary)] line-clamp-2 group-hover:text-primary-500 transition-colors">
          {article.title}
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          {article.source} · {formatRelativeTime(article.publishedAt)}
        </p>
      </div>
    </button>
  );
}

export default function NewsPage() {
  usePageTitle('News Feed');
  const [category, setCategory] = useState<NewsCategory>('all');
  const [page, setPage] = useState(1);

  const { data: feedData, isLoading } = useNewsFeed(category, page);
  const { data: trending } = useTrending();

  const articles = feedData?.articles || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="page-title mb-1">Tech News Feed</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Personalised articles from TechCrunch, Wired, Hacker News and more
        </p>
      </div>

      {/* Category filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide pb-1">
        {CATEGORIES.map(c => (
          <button
            key={c.value}
            onClick={() => { setCategory(c.value); setPage(1); }}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 shrink-0',
              category === c.value
                ? 'bg-primary-500 text-white shadow-glow-sm'
                : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-primary-500/50 hover:text-[var(--color-text-primary)]'
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-6">
        {/* ── Main feed ─────────────────────────────────────── */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-56 rounded-2xl" />)}
            </div>
          ) : articles.length === 0 ? (
            <Card>
              <EmptyState
                icon="📰"
                title="No articles found"
                description="Try a different category or check back later."
              />
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {articles.map(a => <ArticleCard key={a._id} article={a} />)}
            </div>
          )}

          {/* Pagination */}
          {feedData && feedData.pages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-4 py-2 rounded-xl text-sm btn-secondary disabled:opacity-40"
              >
                ← Previous
              </button>
              <span className="text-sm text-[var(--color-text-muted)]">
                Page {page} of {feedData.pages}
              </span>
              <button
                disabled={page >= feedData.pages}
                onClick={() => setPage(p => p + 1)}
                className="px-4 py-2 rounded-xl text-sm btn-secondary disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </div>

        {/* ── Sidebar: Trending ──────────────────────────────── */}
        <div className="space-y-4">
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-primary-500" />
              <h2 className="section-title text-base">Trending Today</h2>
            </div>
            {trending && trending.length > 0 ? (
              <div className="space-y-1 divide-y divide-[var(--color-border-subtle)]">
                {trending.slice(0, 8).map(a => (
                  <TrendingCard key={a._id} article={a} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)] text-center py-4">
                Loading trending articles…
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
