// ============================================================
// NxtStep — Interview API
// ============================================================

import apiClient from './client';
import type {
  InterviewSession,
  SessionStatus_Response,
  StartInterviewRequest,
  StartInterviewResponse,
  SubmitAnswerRequest,
} from '@/types';

interface PaginatedSessions {
  sessions: InterviewSession[];
  total: number;
  page: number;
  pages: number;
}

export const interviewApi = {
  startSession: (data: StartInterviewRequest) =>
    apiClient
      .post<{ success: boolean; data: StartInterviewResponse }>('/interview', data)
      .then((res) => res.data.data!),

  getSessions: (page = 1, limit = 10) =>
    apiClient
      .get<{ success: boolean; data: PaginatedSessions }>('/interview', {
        params: { page, limit },
      })
      .then((res) => res.data.data!),

  getSession: (sessionId: string) =>
    apiClient
      .get<{ success: boolean; data: InterviewSession }>(`/interview/${sessionId}`)
      .then((res) => res.data.data!),

  getSessionStatus: (sessionId: string) =>
    apiClient
      .get<{ success: boolean; data: SessionStatus_Response }>(`/interview/${sessionId}/status`)
      .then((res) => res.data.data!),

  submitAnswer: (sessionId: string, data: SubmitAnswerRequest) =>
    apiClient
      .post<{ success: boolean; data: { status: string; message: string } }>(
        `/interview/${sessionId}/answer`,
        data
      )
      .then((res) => res.data.data!),

  logProctoringEvent: (
    sessionId: string,
    eventType: 'tab_switch' | 'face_missing' | 'multiple_faces' | 'termination',
    timestamp: number,
    details?: Record<string, unknown>
  ) =>
    apiClient
      .post<{ success: boolean; data: { terminated: boolean } }>(
        `/interview/${sessionId}/proctoring`,
        { eventType, timestamp, details }
      )
      .then((res) => res.data.data!),
};
