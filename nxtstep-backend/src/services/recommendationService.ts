// ============================================================
// NxtStep — Recommendation Service
// ============================================================

import { Scorecard } from '../models/Scorecard';
import { RecommendedRole, RoleFeedback } from '../models/Recommendations';
import { InterviewSession } from '../models/InterviewSession';
import { User } from '../models/User';
import { ROLE_DATABASE, RoleTemplate } from '../data/roleDatabase';
import { aiAdapter, AIMessage } from '../ai/aiAdapter';
import { buildRoleDescriptionPrompt } from '../ai/prompts';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { env } from '../config/env';

const WEIGHTS = {
  skillMatch: env.RECOMMEND_WEIGHT_SKILL,
  levelMatch: env.RECOMMEND_WEIGHT_LEVEL,
  preferenceMatch: env.RECOMMEND_WEIGHT_PREFERENCE,
  resumeMatch: env.RECOMMEND_WEIGHT_RESUME,
};

// ── Skill matching ───────────────────────────────────────────
const computeSkillMatch = (
  scorecardScores: Record<string, number>,
  role: RoleTemplate
): number => {
  if (!role.skills || role.skills.length === 0) return 0.5;

  let totalWeight = 0;
  let matchedWeight = 0;

  for (const skill of role.skills) {
    totalWeight += skill.weight ?? 1;
    const dim = mapSkillToDimension(skill.name);
    const score = scorecardScores[dim] ?? 5;
    const threshold = (role.minThresholds as any)?.[dim] ?? 5;
    if (score >= threshold) matchedWeight += skill.weight ?? 1;
  }

  return totalWeight > 0 ? matchedWeight / totalWeight : 0;
};

const mapSkillToDimension = (skillName: string): string => {
  const name = skillName.toLowerCase();
  if (name.includes('communication') || name.includes('explain')) return 'communication';
  if (name.includes('problem') || name.includes('algorithm')) return 'problemSolving';
  if (name.includes('confidence') || name.includes('leadership')) return 'confidence';
  if (name.includes('depth') || name.includes('architecture') || name.includes('design'))
    return 'conceptDepth';
  return 'technical';
};

const computeLevelMatch = (
  overall: number,
  roleLevel: string,
  sessionDifficulty: string
): number => {
  const levelMap: Record<string, [number, number]> = {
    junior: [0, 5.5],
    mid: [4.5, 7.5],
    senior: [6.5, 10],
  };
  const range = levelMap[roleLevel] ?? [0, 10];
  const inRange = overall >= range[0] && overall <= range[1];
  const difficultyMatch = sessionDifficulty === roleLevel ? 1 : 0.5;
  return inRange ? difficultyMatch : 0.2;
};

const computePreferenceMatch = (
  userPreferences: string[],
  roleCategory: string,
  roleTitle: string
): number => {
  if (!userPreferences || userPreferences.length === 0) return 0.5;
  const roleLower = `${roleCategory} ${roleTitle}`.toLowerCase();
  const hits = userPreferences.filter((p) => roleLower.includes(p.toLowerCase())).length;
  return Math.min(hits / userPreferences.length + 0.2, 1);
};

// ── Main recommendation logic ─────────────────────────────────
export const generateRecommendations = async (sessionId: string, userId: string) => {
  const [scorecard, session, user] = await Promise.all([
    Scorecard.findOne({ sessionId, userId }).lean(),
    InterviewSession.findOne({ _id: sessionId, userId }).lean(),
    User.findById(userId).lean(),
  ]);

  if (!scorecard) {
    throw createError('Scorecard not found for session', 404, 'SCORECARD_NOT_FOUND');
  }

  const sc = scorecard as any;
  const overall: number = sc.overall ?? sc.scores?.overall ?? 0;
  const sessionDifficulty = (session as any)?.difficulty ?? 'mid';
  const userPreferences: string[] = (user as any)?.rolePreferences ?? [];

  const scores: Record<string, number> = {
    technical: sc.technical ?? sc.scores?.technical ?? 5,
    problemSolving: sc.problemSolving ?? sc.scores?.problemSolving ?? 5,
    communication: sc.communication ?? sc.scores?.communication ?? 5,
    confidence: sc.confidence ?? sc.scores?.confidence ?? 5,
    conceptDepth: sc.conceptDepth ?? sc.scores?.conceptDepth ?? 5,
  };

  const scoredRoles = ROLE_DATABASE.map((role) => {
    const skillMatch = computeSkillMatch(scores, role);
    const levelMatch = computeLevelMatch(overall, role.level, sessionDifficulty);
    const preferenceMatch = computePreferenceMatch(userPreferences, role.category, role.title);
    const resumeMatch = 0.5;

    const matchScore = parseFloat((
      skillMatch * WEIGHTS.skillMatch +
      levelMatch * WEIGHTS.levelMatch +
      preferenceMatch * WEIGHTS.preferenceMatch +
      resumeMatch * WEIGHTS.resumeMatch
    ).toFixed(3));

    return {
      role,
      matchScore,
      breakdown: { skillMatch, levelMatch, preferenceMatch, resumeMatch },
    };
  });

  const topRoles = scoredRoles
    .filter((r) => r.matchScore >= 0.4)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5);

  const enriched = await Promise.all(
    topRoles.map(async ({ role, matchScore, breakdown }) => {
      try {
        const promptObj = buildRoleDescriptionPrompt({
          title: role.title,
          skills: role.skills.map((s) => s.name),
          scorecard: scores,
        });

        const messages: AIMessage[] = [
          { role: 'system', content: promptObj.system },
          { role: 'user', content: promptObj.user },
        ];

        const enrichment = await aiAdapter.sendJSON<{
          description: string;
          whyMatch: string;
          tips: string[];
        }>(messages, { temperature: 0.4, maxTokens: 600 });

        return {
          roleId: role.id,
          title: role.title,
          category: role.category,
          level: role.level,
          matchScore,
          breakdown,
          explanation: enrichment.description ?? `Strong match for ${role.title}`,
          studyResources: [],
          interviewTips: enrichment.tips ?? [],
          salaryRange: role.salaryRange,
          growthPath: role.growthPath,
        };
      } catch {
        return {
          roleId: role.id,
          title: role.title,
          category: role.category,
          level: role.level,
          matchScore,
          breakdown,
          explanation: `Strong match for ${role.title}`,
          studyResources: [],
          interviewTips: [],
          salaryRange: role.salaryRange,
          growthPath: role.growthPath,
        };
      }
    })
  );

  const recommendation = await RecommendedRole.findOneAndUpdate(
    { sessionId },
    { $set: { userId, roles: enriched } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  logger.info({ sessionId, userId, topRoles: enriched.length }, 'Recommendations generated');
  return recommendation;
};

export const getRecommendations = async (sessionId: string, userId: string) => {
  const rec = await RecommendedRole.findOne({ sessionId, userId }).lean();
  if (!rec) throw createError('Recommendations not found', 404, 'RECOMMENDATIONS_NOT_FOUND');
  return rec;
};

export const submitRoleFeedback = async (
  userId: string,
  sessionId: string,
  roleTitle: string,
  roleCategory: string,
  roleLevel: string,
  signal: 'relevant' | 'not_relevant' | 'applied' | 'saved',
  matchScore: number
) => {
  const feedback = await RoleFeedback.findOneAndUpdate(
    { userId, sessionId, roleTitle },
    { $set: { roleCategory, roleLevel, signal, matchScore } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  logger.info({ userId, sessionId, roleTitle, signal }, 'Role feedback recorded');
  return feedback;
};