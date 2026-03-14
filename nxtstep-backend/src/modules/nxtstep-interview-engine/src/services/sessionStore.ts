// nxtstep-backend/src/modules/nxtstep-interview-engine/src/services/sessionStore.ts

import mongoose from 'mongoose';
import { InterviewSession } from '../../../../models/InterviewSession';
import {
  DifficultyLevel,
  InterviewSession as EngineSession,
  SessionConfig,
  SessionContext,
} from '../types/interview.types';

const DEFAULT_CONFIG: SessionConfig = {
  maxQuestions:            Number(process.env.MAX_QUESTIONS)                     ?? 8,
  maxFollowUpsPerQuestion: Number(process.env.MAX_FOLLOWUPS_PER_QUESTION)        ?? 2,
  confidenceThreshold:     Number(process.env.CONFIDENCE_FOLLOWUP_THRESHOLD)     ?? 5,
  conceptDepthThreshold:   Number(process.env.CONCEPT_DEPTH_FOLLOWUP_THRESHOLD)  ?? 5,
  questionWeights: {
    problem:    1.5,
    concept:    1.0,
    behavioral: 0.7,
  },
};

// ─── In-memory cache (reduces DB reads during active session) ─────────────────
const cache = new Map<string, EngineSession>();

export const sessionStore = {

  async create(context: SessionContext, config?: Partial<SessionConfig>): Promise<EngineSession> {
    const session: EngineSession = {
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

    // Persist to MongoDB — store engine session data in the existing
    // InterviewSession document under a new `engineState` field,
    // OR store the full JSON in a dedicated field. Here we upsert:
    await InterviewSession.findByIdAndUpdate(
      new mongoose.Types.ObjectId(context.sessionId),
      {
        $set: {
          'engineState': JSON.stringify(session),
        },
      },
      { upsert: false } // Session must already exist (created by main interviewService)
    );

    cache.set(context.sessionId, session);
    console.log(`[SessionStore] Created engine state for session ${context.sessionId}`);
    return session;
  },

  async get(sessionId: string): Promise<EngineSession | null> {
    // Check cache first
    if (cache.has(sessionId)) return cache.get(sessionId)!;

    // Fall back to MongoDB
    const doc = await InterviewSession.findById(
      new mongoose.Types.ObjectId(sessionId)
    ).lean();

    if (!doc || !(doc as any).engineState) return null;

    try {
      const session = JSON.parse((doc as any).engineState) as EngineSession;
      // Re-hydrate Date fields (JSON.parse loses Date type)
      session.startedAt  = new Date(session.startedAt);
      if (session.completedAt) session.completedAt = new Date(session.completedAt);
      session.evaluations.forEach(e => {
        e.evaluatedAt = new Date(e.evaluatedAt);
      });
      cache.set(sessionId, session);
      return session;
    } catch {
      console.error(`[SessionStore] Failed to parse engineState for ${sessionId}`);
      return null;
    }
  },

  async save(session: EngineSession): Promise<void> {
    // Update cache
    cache.set(session.sessionId, { ...session });

    // Persist to MongoDB
    await InterviewSession.findByIdAndUpdate(
      new mongoose.Types.ObjectId(session.sessionId),
      { $set: { engineState: JSON.stringify(session) } }
    );
  },

  async delete(sessionId: string): Promise<void> {
    cache.delete(sessionId);
    await InterviewSession.findByIdAndUpdate(
      new mongoose.Types.ObjectId(sessionId),
      { $unset: { engineState: '' } }
    );
    console.log(`[SessionStore] Deleted engine state for session ${sessionId}`);
  },

  activeSessionIds(): string[] {
    return Array.from(cache.keys());
  },
};

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