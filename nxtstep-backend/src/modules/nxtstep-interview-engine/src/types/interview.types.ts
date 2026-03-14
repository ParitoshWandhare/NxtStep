// ============================================================
// NxtStep Interview Engine — Core Type Definitions
// ============================================================

export type InterviewState =
  | 'INIT'
  | 'PREP'
  | 'GENERATE_Q'
  | 'AWAIT_ANSWER'
  | 'PROCESS_ANSWER'
  | 'EVALUATE'
  | 'DECIDE_FOLLOWUP'
  | 'GENERATE_FU'
  | 'AWAIT_FU_ANSWER'
  | 'LOOP'
  | 'TERMINATE'
  | 'AGGREGATE'
  | 'COMPLETE';

export type QuestionType = 'concept' | 'problem' | 'behavioral';

export type DifficultyLevel = 'junior' | 'mid' | 'senior';

// ─── Question ───────────────────────────────────────────────

export interface InterviewQuestion {
  id: string;
  text: string;
  type: QuestionType;
  topic: string;
  difficulty: DifficultyLevel;
  expectedKeywords: string[];
  followUpCount: number;
  isFollowUp: boolean;
  parentQuestionId?: string;
}

// ─── Evaluation ─────────────────────────────────────────────

export interface EvaluationScores {
  technical: number;        // 0–10
  communication: number;    // 0–10
  problemSolving: number;   // 0–10
  confidence: number;       // 0–10
  conceptDepth: number;     // 0–10
}

export interface EvaluationFeedback {
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
}

export interface FollowUpDecision {
  shouldAsk: boolean;
  reason: string;
  missingKeywords: string[];
}

export interface QuestionEvaluation {
  questionId: string;
  sessionId: string;
  answerText: string;
  scores: EvaluationScores;
  feedback: EvaluationFeedback;
  followUp: FollowUpDecision;
  detectedKeywords: string[];
  promptHash?: string;
  evaluatedAt: Date;
}

// ─── Session ────────────────────────────────────────────────

export interface SessionConfig {
  maxQuestions: number;              // default: 8
  maxFollowUpsPerQuestion: number;   // default: 2
  confidenceThreshold: number;       // default: 5
  conceptDepthThreshold: number;     // default: 5
  questionWeights: Record<QuestionType, number>;
}

export interface SessionContext {
  sessionId: string;
  userId: string;
  role: string;
  level: DifficultyLevel;
  resumeText?: string;
  preferences?: string[];
}

export interface InterviewSession {
  sessionId: string;
  state: InterviewState;
  context: SessionContext;
  config: SessionConfig;
  questions: InterviewQuestion[];
  evaluations: QuestionEvaluation[];
  currentQuestionIndex: number;
  totalFollowUps: number;
  startedAt: Date;
  completedAt?: Date;
  scorecardId?: string;
}

// ─── Scorecard ───────────────────────────────────────────────

export interface CategoryScore {
  score: number;
  weight: number;
}

export interface Scorecard {
  sessionId: string;
  userId: string;
  role: string;
  level: DifficultyLevel;
  categoryScores: Record<keyof EvaluationScores, CategoryScore>;
  overallScore: number;
  totalQuestions: number;
  totalFollowUps: number;
  generatedAt: Date;
}

// ─── Queue Job Payloads ──────────────────────────────────────

export interface EvaluateAnswerJob {
  sessionId: string;
  questionId: string;
  answerText: string;
  questionText: string;
  expectedKeywords: string[];
  questionType: QuestionType;
}

export interface GenerateQuestionJob {
  sessionId: string;
  role: string;
  level: DifficultyLevel;
  topic: string;
  previousQuestions: string[];
}

export interface GenerateFollowUpJob {
  sessionId: string;
  questionId: string;
  originalQuestion: string;
  candidateAnswer: string;
  missingKeywords: string[];
}

export interface ComputeScorecardJob {
  sessionId: string;
  userId: string;
}

// ─── AI Adapter ──────────────────────────────────────────────

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIAdapterOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface AIAdapterResponse<T = unknown> {
  data: T;
  promptHash: string;
  latencyMs: number;
  model: string;
}

// ─── Raw AI Outputs (before normalization) ───────────────────

export interface RawQuestionOutput {
  id: string;
  text: string;
  type: QuestionType;
  expectedKeywords: string[];
  difficulty: DifficultyLevel;
}

export interface RawEvaluationOutput {
  scores: EvaluationScores;
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  shouldAskFollowUp: boolean;
  missingKeywords: string[];
  detectedKeywords: string[];
}

export interface RawFollowUpOutput {
  text: string;
  targetKeywords: string[];
}
