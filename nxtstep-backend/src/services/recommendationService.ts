// ============================================================
// NxtStep — Recommendation Service
// FIX: Scorecard fields are flat top-level (technical,
// problemSolving, etc.) not nested under scores:{}.
// Also: always return top 5 roles regardless of threshold so
// the user always sees recommendations after an interview.
// ============================================================

import { Scorecard } from '../models/Scorecard';
import { RecommendedRole, RoleFeedback } from '../models/Recommendations';
import { InterviewSession } from '../models/InterviewSession';
import { User } from '../models/User';
import { ROLE_DATABASE, RoleTemplate } from '../data/roleDatabase';
import { aiAdapter, AIMessage } from '../ai/aiAdapter';
import { buildRoleDescriptionPrompt } from '../ai/prompts';
import { emitRecommendationsReady } from '../sockets/index';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { env } from '../config/env';

const WEIGHTS = {
  skillMatch:       env.RECOMMEND_WEIGHT_SKILL,
  levelMatch:       env.RECOMMEND_WEIGHT_LEVEL,
  preferenceMatch:  env.RECOMMEND_WEIGHT_PREFERENCE,
  resumeMatch:      env.RECOMMEND_WEIGHT_RESUME,
};

// ── Skill → dimension mapping ─────────────────────────────────
const mapSkillToDimension = (skillName: string): string => {
  const name = skillName.toLowerCase();
  if (name.includes('communication') || name.includes('explain'))  return 'communication';
  if (name.includes('problem')       || name.includes('algorithm')) return 'problemSolving';
  if (name.includes('confidence')    || name.includes('leadership')) return 'confidence';
  if (name.includes('depth')         || name.includes('architecture') || name.includes('design'))
    return 'conceptDepth';
  return 'technical';
};

const computeSkillMatch = (
  scores: Record<string, number>,
  role: RoleTemplate
): number => {
  if (!role.skills || role.skills.length === 0) return 0.5;

  let totalWeight  = 0;
  let matchedWeight = 0;

  for (const skill of role.skills) {
    const w   = skill.weight ?? 1;
    totalWeight += w;
    const dim       = mapSkillToDimension(skill.name);
    const score     = scores[dim] ?? 5;
    const threshold = (role.minThresholds as any)?.[dim] ?? 5;

    if (score >= threshold)           matchedWeight += w;
    else if (score >= threshold - 1.5) matchedWeight += w * 0.5;
  }

  return totalWeight > 0 ? matchedWeight / totalWeight : 0;
};

const computeLevelMatch = (
  overall: number,
  roleLevel: string,
  sessionDifficulty: string
): number => {
  const levelMap: Record<string, [number, number]> = {
    junior: [0,   5.5],
    mid:    [4.5, 7.5],
    senior: [6.5, 10],
  };
  const [lo, hi] = levelMap[roleLevel] ?? [0, 10];
  const inRange       = overall >= lo && overall <= hi;
  const difficultyBonus = sessionDifficulty === roleLevel ? 0.1 : 0;
  return Math.min((inRange ? 0.9 : 0.3) + difficultyBonus, 1);
};

const computePreferenceMatch = (
  userPreferences: string[],
  roleCategory: string,
  roleTitle: string
): number => {
  if (!userPreferences || userPreferences.length === 0) return 0.5;
  const roleLower = `${roleCategory} ${roleTitle}`.toLowerCase();
  const hits = userPreferences.filter(p => roleLower.includes(p.toLowerCase())).length;
  return Math.min(hits / userPreferences.length + 0.2, 1);
};

// ── Main recommendation pipeline ──────────────────────────────
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

  // ── Read FLAT fields from the Scorecard document ─────────────
  // The model stores technical, problemSolving, etc. at the top
  // level — NOT nested inside a scores:{} sub-object.
  const scores: Record<string, number> = {
    technical:      sc.technical      ?? 5,
    problemSolving: sc.problemSolving ?? 5,
    communication:  sc.communication  ?? 5,
    confidence:     sc.confidence     ?? 5,
    conceptDepth:   sc.conceptDepth   ?? 5,
  };
  const overall: number          = sc.overall ?? 5;
  const sessionDifficulty: string = (session as any)?.difficulty ?? 'mid';
  const userPreferences: string[] = (user as any)?.rolePreferences ?? [];

  // ── Score every role ──────────────────────────────────────────
  const scoredRoles = ROLE_DATABASE.map(role => {
    const skillMatch      = computeSkillMatch(scores, role);
    const levelMatch      = computeLevelMatch(overall, role.level, sessionDifficulty);
    const preferenceMatch = computePreferenceMatch(userPreferences, role.category, role.title);
    const resumeMatch     = 0.5; // neutral when no resume

    const matchScore = parseFloat((
      skillMatch      * WEIGHTS.skillMatch      +
      levelMatch      * WEIGHTS.levelMatch      +
      preferenceMatch * WEIGHTS.preferenceMatch +
      resumeMatch     * WEIGHTS.resumeMatch
    ).toFixed(3));

    return { role, matchScore, breakdown: { skillMatch, levelMatch, preferenceMatch, resumeMatch } };
  });

  // Sort descending; always take top 5 regardless of threshold
  // so the user always sees recommendations after an interview.
  const sorted = scoredRoles.sort((a, b) => b.matchScore - a.matchScore);
  const topRoles = sorted.slice(0, 5);

  // ── AI-enrich top roles in parallel ──────────────────────────
  const enriched = await Promise.all(
    topRoles.map(async ({ role, matchScore, breakdown }) => {
      let description = `Strong match for ${role.title} based on your interview performance.`;
      let whyMatch    = `Your profile aligns well with the ${role.category} requirements.`;
      let tips: string[] = [];

      try {
        const promptObj = buildRoleDescriptionPrompt({
          title:     role.title,
          skills:    role.skills.map(s => s.name),
          scorecard: scores,
        });

        const messages: AIMessage[] = [
          { role: 'system', content: promptObj.system },
          { role: 'user',   content: promptObj.user   },
        ];

        const enrichment = await aiAdapter.sendJSON<{
          description: string;
          whyMatch:    string;
          tips:        string[];
        }>(messages, { temperature: 0.4, maxTokens: 600 });

        description = enrichment.description ?? description;
        whyMatch    = enrichment.whyMatch    ?? whyMatch;
        tips        = enrichment.tips        ?? [];
      } catch (err) {
        logger.warn({ err, roleId: role.id }, 'AI enrichment failed — using defaults');
      }

      return {
        roleId:       role.id,
        title:        role.title,
        category:     role.category,
        level:        role.level,
        description,
        whyMatch,
        requiredSkills: role.skills,
        matchScore,
        breakdown,
        explanation:    [`${role.title} matches your ${sessionDifficulty}-level profile`],
        studyResources: [],
        interviewTips:  tips,
        salaryRange:    role.salaryRange,
        growthPath:     role.growthPath ?? [],
      };
    })
  );

  const recommendation = await RecommendedRole.findOneAndUpdate(
    { sessionId },
    { $set: { userId, roles: enriched } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  emitRecommendationsReady(sessionId, recommendation);
  logger.info({ sessionId, userId, count: enriched.length }, 'Recommendations generated');
  return recommendation;
};

export const getRecommendations = async (sessionId: string, userId: string) => {
  const rec = await RecommendedRole.findOne({ sessionId, userId }).lean();
  if (!rec) throw createError('Recommendations not found', 404, 'RECOMMENDATIONS_NOT_FOUND');
  return rec;
};

export const submitRoleFeedback = async (
  userId:       string,
  sessionId:    string,
  roleTitle:    string,
  roleCategory: string,
  roleLevel:    string,
  signal:       'relevant' | 'not_relevant' | 'applied' | 'saved',
  matchScore:   number
) => {
  const feedback = await RoleFeedback.findOneAndUpdate(
    { userId, sessionId, roleTitle },
    { $set: { roleCategory, roleLevel, signal, matchScore } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  logger.info({ userId, sessionId, roleTitle, signal }, 'Role feedback recorded');
  return feedback;
};