// ============================================================
// NxtStep — React Query Hooks
// ============================================================

import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from '@tanstack/react-query';
import { authApi } from '@/api/auth.api';
import { interviewApi } from '@/api/interview.api';
import { scoresApi } from '@/api/scores.api';
import { recommendationsApi, newsApi } from '@/api/index';
import { useAppDispatch } from '@/app/hooks';
import { setCredentials, updateUser, logout } from '@/features/auth/authSlice';
import {
  startSession as startSessionAction,
} from '@/features/interview/interviewSlice';
import toast from 'react-hot-toast';
import type {
  LoginRequest,
  RegisterRequest,
  StartInterviewRequest,
  SubmitAnswerRequest,
  FeedbackSignal,
  NewsCategory,
  NewsAction,
} from '@/types';

// Query Keys
export const QUERY_KEYS = {
  profile: ['profile'] as const,
  sessions: (page?: number) => ['sessions', page] as const,
  session: (id: string) => ['session', id] as const,
  sessionStatus: (id: string) => ['sessionStatus', id] as const,
  scorecards: (page?: number) => ['scorecards', page] as const,
  scorecard: (sessionId: string) => ['scorecard', sessionId] as const,
  recommendations: (sessionId: string) => ['recommendations', sessionId] as const,
  newsFeed: (category: string, page: number) => ['newsFeed', category, page] as const,
  trending: ['trending'] as const,
} as const;

// ── Auth Mutations ────────────────────────────────────────────
export function useLogin() {
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: (data: LoginRequest) => authApi.login(data),
    onSuccess: (data) => {
      dispatch(setCredentials({ token: data.token, user: data.user }));
      toast.success(`Welcome back, ${data.user.name}!`);
    },
  });
}

export function useRegister() {
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: (data: RegisterRequest) => authApi.register(data),
    onSuccess: (data) => {
      dispatch(setCredentials({ token: data.token, user: data.user }));
      toast.success('Account created! Please verify your email.');
    },
  });
}

export function useVerifyEmail() {
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: (otp: string) => authApi.verifyEmail(otp),
    onSuccess: (data) => {
      dispatch(setCredentials({ token: data.token, user: data.user }));
      toast.success('Email verified! Welcome to NxtStep.');
    },
  });
}

export function useResendOtp() {
  return useMutation({
    mutationFn: () => authApi.resendOtp(),
    onSuccess: () => toast.success('Verification code sent!'),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
    onSuccess: () =>
      toast.success('If that email exists, a reset link has been sent.'),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      authApi.resetPassword(token, password),
    onSuccess: () => toast.success('Password reset successfully!'),
  });
}

export function useLogout() {
  const dispatch = useAppDispatch();
  const qc = useQueryClient();
  return () => {
    dispatch(logout());
    qc.clear();
    toast.success('Logged out successfully');
  };
}

// ── Profile Queries ───────────────────────────────────────────
export function useProfile(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.profile,
    queryFn: () => authApi.getProfile(),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateProfile() {
  const dispatch = useAppDispatch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; rolePreferences?: string[]; interests?: string[] }) =>
      authApi.updateSettings(data),
    onSuccess: (user) => {
      dispatch(updateUser(user));
      qc.setQueryData(QUERY_KEYS.profile, user);
      toast.success('Profile updated!');
    },
  });
}

// ── Interview Queries ─────────────────────────────────────────
export function useStartInterview() {
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: (data: StartInterviewRequest) => interviewApi.startSession(data),
    onSuccess: (data) => {
      dispatch(startSessionAction({
        sessionId: data.sessionId,
        sessionToken: data.sessionToken,
      }));
    },
  });
}

export function useSessions(page = 1) {
  return useQuery({
    queryKey: QUERY_KEYS.sessions(page),
    queryFn: () => interviewApi.getSessions(page),
    staleTime: 2 * 60_000,
  });
}

export function useSession(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.session(sessionId),
    queryFn: () => interviewApi.getSession(sessionId),
    enabled: enabled && !!sessionId,
    staleTime: 30_000,
  });
}

export function useSessionStatus(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.sessionStatus(sessionId),
    queryFn: () => interviewApi.getSessionStatus(sessionId),
    enabled: enabled && !!sessionId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'terminated') return false;
      return 3000;
    },
  });
}

export function useSubmitAnswer(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SubmitAnswerRequest) => interviewApi.submitAnswer(sessionId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.session(sessionId) });
    },
  });
}

export function useLogProctoringEvent(sessionId: string) {
  return useMutation({
    mutationFn: ({
      eventType,
      details,
    }: {
      eventType: 'tab_switch' | 'face_missing' | 'multiple_faces' | 'termination';
      details?: Record<string, unknown>;
    }) =>
      interviewApi.logProctoringEvent(sessionId, eventType, Date.now(), details),
  });
}

// ── Scores Queries ────────────────────────────────────────────
export function useScorecards(page = 1) {
  return useQuery({
    queryKey: QUERY_KEYS.scorecards(page),
    queryFn: () => scoresApi.getUserScorecards(page),
    staleTime: 5 * 60_000,
  });
}

export function useScorecard(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.scorecard(sessionId),
    queryFn: () => scoresApi.getScorecard(sessionId),
    enabled: enabled && !!sessionId,
    staleTime: 10 * 60_000,
    retry: (failureCount, error: unknown) => {
      // Don't retry 404 — scorecard may not be ready yet
      if ((error as { response?: { status?: number } })?.response?.status === 404) return false;
      return failureCount < 3;
    },
  });
}

// ── Recommendations Queries ───────────────────────────────────
export function useRecommendations(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.recommendations(sessionId),
    queryFn: () => recommendationsApi.getRecommendations(sessionId),
    enabled: enabled && !!sessionId,
    staleTime: 15 * 60_000,
    retry: (failureCount, error: unknown) => {
      if ((error as { response?: { status?: number } })?.response?.status === 404) return false;
      return failureCount < 3;
    },
  });
}

export function useSubmitRoleFeedback(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      roleTitle: string;
      roleCategory: string;
      roleLevel: string;
      signal: FeedbackSignal;
      matchScore: number;
    }) => recommendationsApi.submitFeedback(sessionId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.recommendations(sessionId) });
      toast.success('Feedback recorded!');
    },
  });
}

// ── News Queries ──────────────────────────────────────────────
export function useNewsFeed(category: NewsCategory = 'all', page = 1) {
  return useQuery({
    queryKey: QUERY_KEYS.newsFeed(category, page),
    queryFn: () => newsApi.getFeed(category, page),
    staleTime: 2 * 60_000,
    placeholderData: (prev) => prev,
  });
}

export function useTrending() {
  return useQuery({
    queryKey: QUERY_KEYS.trending,
    queryFn: () => newsApi.getTrending(),
    staleTime: 5 * 60_000,
  });
}

export function useSubmitNewsFeedback() {
  return useMutation({
    mutationFn: ({ articleId, action }: { articleId: string; action: NewsAction }) =>
      newsApi.submitFeedback(articleId, action),
  });
}