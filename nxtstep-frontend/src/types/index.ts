// ============================================================
// NxtStep — Global TypeScript Types
// ============================================================

// ── Auth Types ────────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  email: string;
  isEmailVerified: boolean;
  rolePreferences?: string[];
  interests?: string[];
  resumeUrl?: string;
  loginCount?: number;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  rolePreferences?: string[];
}

export interface AuthResponse {
  token: string;
  user: User;
  message?: string;
}

// ── Interview Types ───────────────────────────────────────────
export type Difficulty = 'junior' | 'mid' | 'senior';
export type SessionStatus = 'pending' | 'in_progress' | 'completed' | 'terminated';
export type QuestionType = 'concept' | 'problem' | 'behavioral' | 'follow_up' | 'technical';

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  topic: string;
  difficulty: Difficulty;
  expectedKeywords: string[];
  followUpCount: number;
  parentQuestionId?: string;
}

export interface Answer {
  questionId: string;
  answerText: string;
  answerAudioUrl?: string;
  timestamps: { start: string; end: string };
  evaluationId?: string;
}

export interface ProctoringData {
  tabSwitchCount: number;
  cameraEvents: CameraEvent[];
  terminated: boolean;
  terminationReason?: string;
}

export interface CameraEvent {
  timestamp: string;
  eventType: 'face_absent' | 'face_detected' | 'camera_error';
  details?: string;
}

export interface InterviewSession {
  _id: string;
  userId: string;
  role: string;
  difficulty: Difficulty;
  questions: Question[];
  answers: Answer[];
  proctoring: ProctoringData;
  scorecardId?: string;
  status: SessionStatus;
  currentQuestionIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface SessionStatus_Response {
  status: SessionStatus;
  questionsGenerated: number;
  answersSubmitted: number;
  isTerminated: boolean;
}

export interface StartInterviewRequest {
  role: string;
  difficulty?: Difficulty;
  topics?: string[];
  customJobDescription?: string;
}

export interface StartInterviewResponse {
  sessionId: string;
  sessionToken: string;
  status: string;
}

export interface SubmitAnswerRequest {
  questionId: string;
  answerText: string;
  answerAudioUrl?: string;
  durationMs?: number;
}

// ── Evaluation Types ──────────────────────────────────────────
export interface DimensionScores {
  technical: number;
  communication: number;
  problemSolving: number;
  confidence: number;
  conceptDepth: number;
}

export interface EvaluationResult {
  questionId: string;
  scores: DimensionScores;
  overall: number;
  feedback: {
    strengths: string[];
    weaknesses: string[];
    improvements: string[];
  };
}

// ── Scorecard Types ───────────────────────────────────────────
export interface Scorecard {
  _id: string;
  sessionId: string | { _id: string; role: string; difficulty: Difficulty; createdAt: string; status: SessionStatus };
  userId: string;
  technical: number;
  problemSolving: number;
  communication: number;
  confidence: number;
  conceptDepth: number;
  overall: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  questionsEvaluated: number;
  createdAt: string;
  updatedAt: string;
}

// ── Recommendations Types ─────────────────────────────────────
export interface SalaryRange {
  min: number;
  max: number;
  currency: string;
}

export interface RoleMatch {
  roleId: string;
  title: string;
  category: string;
  level: Difficulty;
  description: string;
  whyMatch: string;
  requiredSkills: { name: string; weight: number }[];
  matchScore: number;
  breakdown: {
    skillMatch: number;
    levelMatch: number;
    preferenceMatch: number;
    resumeMatch: number;
  };
  explanation: string[];
  studyResources: string[];
  interviewTips: string[];
  salaryRange?: SalaryRange;
  growthPath: string[];
}

export interface Recommendations {
  _id: string;
  sessionId: string;
  userId: string;
  roles: RoleMatch[];
  computedAt: string;
  version: number;
}

export type FeedbackSignal = 'relevant' | 'not_relevant' | 'applied' | 'saved';

// ── News Types ────────────────────────────────────────────────
export type NewsCategory = 'tech' | 'business' | 'finance' | 'ai' | 'startups' | 'all';
export type NewsAction = 'click' | 'save' | 'share' | 'dismiss';

export interface NewsArticle {
  _id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  category: Exclude<NewsCategory, 'all'>;
  summary: string;
  tags: string[];
  imageUrl?: string;
  globalClickCount: number;
  createdAt: string;
}

export interface NewsFeedResponse {
  articles: NewsArticle[];
  total: number;
  page: number;
  pages: number;
}

// ── API Response Wrapper ──────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  meta?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  errors?: unknown[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

// ── UI Types ──────────────────────────────────────────────────
export type Theme = 'light' | 'dark' | 'system';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
}

export interface Modal {
  isOpen: boolean;
  component?: React.ReactNode;
}

// ── Socket.IO Event Payloads ──────────────────────────────────
export interface SocketQuestionReadyPayload {
  id: string;
  text: string;
  type: QuestionType;
  topic: string;
  difficulty: Difficulty;
  expectedKeywords: string[];
  followUpCount: number;
  parentQuestionId?: string;
}

export interface SocketEvaluationCompletePayload {
  questionId: string;
  scores: DimensionScores;
  overall: number;
  feedback: {
    strengths: string[];
    weaknesses: string[];
    improvements?: string[];
  };
}

export interface SocketScorecardReadyPayload {
  _id: string;
  sessionId: string;
  overall: number;
  technical: number;
  problemSolving: number;
  communication: number;
  confidence: number;
  conceptDepth: number;
}

// ── Form Types ────────────────────────────────────────────────
export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  rolePreferences?: string[];
}

export interface ForgotPasswordFormData {
  email: string;
}

export interface ResetPasswordFormData {
  password: string;
  confirmPassword: string;
}

export interface OtpFormData {
  otp: string;
}

export interface ProfileUpdateFormData {
  name?: string;
  rolePreferences?: string[];
  interests?: string[];
}

export interface StartInterviewFormData {
  role: string;
  difficulty: Difficulty;
  topics: string[];
  customJobDescription?: string;
}

// ── Health Check ──────────────────────────────────────────────
export interface HealthStatus {
  status: string;
  timestamp: string;
  services: {
    database: {
      isConnected: boolean;
      readyState: number;
      host: string;
      name: string;
    };
    redis: string;
  };
  uptime: number;
  memoryMB: number;
}

// ── Redux State ───────────────────────────────────────────────
export interface InterviewReduxState {
  sessionId: string | null;
  sessionToken: string | null;
  currentQuestion: Question | null;
  pendingAnswer: string;
  isAnswering: boolean;
  isWaitingForQuestion: boolean;
  evaluationResults: Record<string, EvaluationResult>;
  proctoringWarnings: number;
  isSessionActive: boolean;
  engineState: string;
}

export interface UIReduxState {
  theme: Theme;
  sidebarOpen: boolean;
  isMobile: boolean;
}