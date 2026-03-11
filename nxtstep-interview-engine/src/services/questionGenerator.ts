// ============================================================
// NxtStep Interview Engine — Question Generator
// ============================================================

import crypto from 'crypto';
import { aiAdapter } from '../ai/aiAdapter';
import { buildQuestionPrompt, ROLE_TOPICS } from '../ai/prompts';
import {
  DifficultyLevel,
  InterviewQuestion,
  RawQuestionOutput,
} from '../types/interview.types';

// ─── Topic selector ──────────────────────────────────────────

/**
 * Picks the next topic for a question, avoiding recently-used ones.
 */
export function pickTopic(
  role: string,
  usedTopics: string[],
): string {
  const normalizedRole = role.toLowerCase().replace(/\s+/g, '');

  // Match role key from taxonomy (fuzzy)
  const key = Object.keys(ROLE_TOPICS).find(k => normalizedRole.includes(k));
  const topics = key ? ROLE_TOPICS[key] : ROLE_TOPICS['backend'];

  // Prefer unused topics; fall back to full list if all used
  const available = topics.filter(t => !usedTopics.includes(t));
  const pool = available.length > 0 ? available : topics;

  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Question normalizer ──────────────────────────────────────

function normalizeQuestion(
  raw: RawQuestionOutput,
  topic: string,
  isFollowUp: boolean,
  parentQuestionId?: string,
): InterviewQuestion {
  return {
    id:               raw.id ?? `q_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    text:             raw.text,
    type:             raw.type ?? 'concept',
    topic,
    difficulty:       raw.difficulty,
    expectedKeywords: Array.isArray(raw.expectedKeywords) ? raw.expectedKeywords : [],
    followUpCount:    0,
    isFollowUp,
    parentQuestionId,
  };
}

// ─── Main generator ───────────────────────────────────────────

export async function generateQuestion(params: {
  sessionId:           string;
  role:                string;
  level:               DifficultyLevel;
  previousQuestions:   InterviewQuestion[];
}): Promise<InterviewQuestion> {
  const { role, level, previousQuestions } = params;

  const usedTopics = previousQuestions.map(q => q.topic);
  const topic      = pickTopic(role, usedTopics);
  const seed       = crypto.randomBytes(4).toString('hex');

  const { system, user } = buildQuestionPrompt({
    role,
    level,
    topic,
    previousQuestions: previousQuestions.map(q => q.topic),
    seed,
  });

  const messages = aiAdapter.buildMessages(system, user);
  const response = await aiAdapter.sendJSON<RawQuestionOutput>(messages, {
    temperature: 0.7,  // Some creativity for varied questions
    maxTokens:   300,
  });

  const question = normalizeQuestion(response.data, topic, false);

  console.log(
    `[QuestionGenerator] Generated question ${question.id} | ` +
    `topic: ${topic} | type: ${question.type} | latency: ${response.latencyMs}ms`
  );

  return question;
}

// ─── Follow-up generator ──────────────────────────────────────

export async function generateFollowUp(params: {
  sessionId:        string;
  parentQuestion:   InterviewQuestion;
  candidateAnswer:  string;
  missingKeywords:  string[];
}): Promise<InterviewQuestion> {
  const { parentQuestion, candidateAnswer, missingKeywords } = params;

  const { buildFollowUpPrompt } = await import('../ai/prompts');
  const { system, user } = buildFollowUpPrompt({
    originalQuestion: parentQuestion.text,
    candidateAnswer,
    missingKeywords,
  });

  const messages = aiAdapter.buildMessages(system, user);
  const response = await aiAdapter.sendJSON<{ text: string; targetKeywords: string[] }>(
    messages,
    { temperature: 0.5, maxTokens: 150 }
  );

  const followUp: InterviewQuestion = {
    id:               `fu_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    text:             response.data.text,
    type:             parentQuestion.type,
    topic:            parentQuestion.topic,
    difficulty:       parentQuestion.difficulty,
    expectedKeywords: response.data.targetKeywords ?? missingKeywords,
    followUpCount:    0,
    isFollowUp:       true,
    parentQuestionId: parentQuestion.id,
  };

  console.log(
    `[QuestionGenerator] Follow-up for ${parentQuestion.id} | ` +
    `targeting: [${missingKeywords.join(', ')}] | latency: ${response.latencyMs}ms`
  );

  return followUp;
}
