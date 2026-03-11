// ============================================================
// NxtStep Interview Engine — Session Store
// In-memory store with MongoDB persistence interface.
// In production, swap the in-memory map for Mongoose model calls.
// ============================================================

import {
  DifficultyLevel,
  InterviewSession,
  SessionConfig,
  SessionContext,
} from '../types/interview.types';

// ─── Default session config ───────────────────────────────────

const DEFAULT_CONFIG: SessionConfig = {
  maxQuestions:              Number(process.env.MAX_QUESTIONS)                ?? 8,
  maxFollowUpsPerQuestion:   Number(process.env.MAX_FOLLOWUPS_PER_QUESTION)   ?? 2,
  confidenceThreshold:       Number(process.env.CONFIDENCE_FOLLOWUP_THRESHOLD) ?? 5,
  conceptDepthThreshold:     Number(process.env.CONCEPT_DEPTH_FOLLOWUP_THRESHOLD) ?? 5,
  questionWeights: {
    problem:    1.5,
    concept:    1.0,
    behavioral: 0.7,
  },
};

// ─── In-memory map (dev / test) ───────────────────────────────

const store = new Map<string, InterviewSession>();

// ─── Store interface ──────────────────────────────────────────

export const sessionStore = {
  /**
   * Creates and persists a new session.
   */
  async create(context: SessionContext, config?: Partial<SessionConfig>): Promise<InterviewSession> {
    const session: InterviewSession = {
      sessionId:            context.sessionId,
      state:                'INIT',
      context,
      config:               { ...DEFAULT_CONFIG, ...config },
      questions:            [],
      evaluations:          [],
      currentQuestionIndex: 0,
      totalFollowUps:       0,
      startedAt:            new Date(),
    };

    store.set(context.sessionId, session);
    console.log(`[SessionStore] Created session ${context.sessionId}`);
    return session;
  },

  /**
   * Retrieves a session by ID.
   */
  async get(sessionId: string): Promise<InterviewSession | null> {
    return store.get(sessionId) ?? null;
  },

  /**
   * Persists session state (overwrites existing entry).
   */
  async save(session: InterviewSession): Promise<void> {
    store.set(session.sessionId, { ...session });
  },

  /**
   * Deletes a session (e.g., after completion or timeout).
   */
  async delete(sessionId: string): Promise<void> {
    store.delete(sessionId);
    console.log(`[SessionStore] Deleted session ${sessionId}`);
  },

  /**
   * Returns all active session IDs (for monitoring).
   */
  activeSessionIds(): string[] {
    return Array.from(store.keys());
  },
};

// ─── Session factory helper ───────────────────────────────────

export function buildSessionContext(params: {
  sessionId:    string;
  userId:       string;
  role:         string;
  level:        DifficultyLevel;
  resumeText?:  string;
  preferences?: string[];
}): SessionContext {
  return {
    sessionId:   params.sessionId,
    userId:      params.userId,
    role:        params.role,
    level:       params.level,
    resumeText:  params.resumeText,
    preferences: params.preferences,
  };
}
