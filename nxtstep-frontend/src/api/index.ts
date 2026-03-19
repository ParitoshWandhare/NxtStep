// ============================================================
// NxtStep — Recommendations API
// ============================================================

import apiClient from './client';
import type { FeedbackSignal, Recommendations } from '@/types';

export const recommendationsApi = {
  getRecommendations: (sessionId: string) =>
    apiClient
      .get<{ success: boolean; data: Recommendations }>(`/recommend/${sessionId}`)
      .then((res) => res.data.data!),

  submitFeedback: (
    sessionId: string,
    payload: {
      roleTitle: string;
      roleCategory: string;
      roleLevel: string;
      signal: FeedbackSignal;
      matchScore: number;
    }
  ) =>
    apiClient
      .post<{ success: boolean; data: unknown }>(`/recommend/${sessionId}/feedback`, payload)
      .then((res) => res.data),
};

// ============================================================
// NxtStep — News API
// ============================================================

import type { NewsArticle, NewsFeedResponse, NewsAction, NewsCategory } from '@/types';

export const newsApi = {
  getFeed: (category: NewsCategory = 'all', page = 1, limit = 20) =>
    apiClient
      .get<{ success: boolean; data: NewsFeedResponse }>('/news', {
        params: { category, page, limit },
      })
      .then((res) => res.data.data!),

  getTrending: () =>
    apiClient
      .get<{ success: boolean; data: NewsArticle[] }>('/news/trending')
      .then((res) => res.data.data!),

  submitFeedback: (articleId: string, action: NewsAction) =>
    apiClient
      .post<{ success: boolean }>('/news/feedback', { articleId, action })
      .then((res) => res.data),
};

// ============================================================
// NxtStep — Health API
// ============================================================

import type { HealthStatus } from '@/types';

export const healthApi = {
  check: () =>
    apiClient
      .get<{ success: boolean; data: HealthStatus }>('/health')
      .then((res) => res.data.data!),
};