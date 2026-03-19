// ============================================================
// NxtStep — Scores API
// ============================================================

import apiClient from './client';
import type { Scorecard } from '@/types';

interface PaginatedScorecards {
  scorecards: Scorecard[];
  total: number;
  page: number;
  pages: number;
}

export const scoresApi = {
  getUserScorecards: (page = 1, limit = 10) =>
    apiClient
      .get<{ success: boolean; data: PaginatedScorecards }>('/scores', {
        params: { page, limit },
      })
      .then((res) => res.data.data!),

  getScorecard: (sessionId: string) =>
    apiClient
      .get<{ success: boolean; data: Scorecard }>(`/scores/${sessionId}`)
      .then((res) => res.data.data!),
};