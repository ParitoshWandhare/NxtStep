// ============================================================
// NxtStep — Recommendation Engine Module
// Scorecard → skill mapping → weighted match → AI enrichment
// Weights: 0.5 skillMatch + 0.2 levelMatch + 0.15 preferenceMatch + 0.15 resumeMatch
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
  skillMatch: env.RECOMMEND_WEIGHT_SKILL,
  levelMatch: env.RECOMMEND_WEIGHT_LEVEL,
  preferenceMatch: env.RECOMMEND_WEIGHT_PREFERENCE,
  resumeMatch: env.RECOMMEND_WEIGHT_RESUME,
};

// ── Dimension → skill name mapping ───────────────────────────
const SKILL_TO_DIMENSION: Record<string, string> = {
  communication: 'communication',
  leadership: 'confidence',
  presentation: 'communication',
  algorithm: 'problemSolving',
  'problem solving': 'problemSolving',
  architecture: 'conceptDepth',
  design: 'conceptDepth',
  depth: 'conceptDepth',
};

const mapSkillToDimension = (skillName: string): string => {
  const lower = skillName.toLowerCase();
  for (const [keyword, dim] of Object.entries(SKILL_TO_DIMENSION)) {
    if (lower.includes(keyword)) return dim;
  }
  return 'technical';
};

// ── Compute individual match dimensions ──────────────────────
const computeSkillMatch = (scores: Record<string, number>, role: RoleTemplate): number => {
  if (!role.skills?.length) return 0.5;
  let totalWeight = 0;
  let matchedWeight = 0;
  for (const skill of role.skills) {
    const w = skill.weight ?? 1;
    totalWeight += w;
    const dim = mapSkillToDimension(skill.name);
    const score = scores[dim] ?? 5;
    const threshold = (role.minThresholds as any)?.[dim] ?? 5;
    if (score >= threshold) matchedWeight += w;
    else if (score >= threshold - 1.5) matchedWeight += w * 0.5;
  }
  return totalWeight > 0 ? Math.min(matchedWeight / totalWeight, 1) : 0.5;
};

const computeLevelMatch = (overall: number, roleLevel: string, sessionDifficulty: string): number => {
  const ranges: Record<string, [number, number]> = {
    junior: [0, 5.5],
    mid: [4.5, 7.5],
    senior: [6.5, 10],
  };
  const [lo, hi] = ranges[roleLevel] ?? [0, 10];
  const inRange = overall >= lo && overall <= hi;
  const difficultyBonus = sessionDifficulty === roleLevel ? 0.1 : 0;
  return Math.min((inRange ? 0.9 : 0.2) + difficultyBonus, 1);
};

const computePreferenceMatch = (prefs: string[], roleCategory: string, roleTitle: string): number => {
  if (!prefs?.length) return 0.5;
  const roleLower = `${roleCategory} ${roleTitle}`.toLowerCase();
  const hits = prefs.filter((p) => roleLower.includes(p.toLowerCase())).length;
  return Math.min(hits / prefs.length + 0.2, 1);
};

// ── Resume keyword match ──────────────────────────────────────
const computeResumeMatch = (resumeText: string | undefined, role: RoleTemplate): number => {
  if (!resumeText) return 0.5;
  const resumeLower = resumeText.toLowerCase();
  const skillNames = role.skills.map((s) => s.name.toLowerCase());
  const hits = skillNames.filter((s) => resumeLower.includes(s)).length;
  return Math.min(hits / Math.max(skillNames.length, 1), 1);
};

// ── Main recommendation pipeline ─────────────────────────────
export const generateRecommendations = async (sessionId: string, userId: string) => {
  const [scorecard, session, user] = await Promise.all([
    Scorecard.findOne({ sessionId, userId }).lean(),
    InterviewSession.findOne({ _id: sessionId, userId }).lean(),
    User.findById(userId).lean(),
  ]);

  if (!scorecard) throw createError('Scorecard not found for session', 404, 'SCORECARD_NOT_FOUND');

  const sc = scorecard as any;
  const overall: number = sc.overall ?? sc.scores?.overall ?? 0;
  const sessionDifficulty: string = (session as any)?.difficulty ?? 'mid';
  const userPreferences: string[] = (user as any)?.rolePreferences ?? [];
  const resumeText: string | undefined = (user as any)?.resumeText;

  const scores: Record<string, number> = {
    technical: sc.technical ?? sc.scores?.technical ?? 5,
    problemSolving: sc.problemSolving ?? sc.scores?.problemSolving ?? 5,
    communication: sc.communication ?? sc.scores?.communication ?? 5,
    confidence: sc.confidence ?? sc.scores?.confidence ?? 5,
    conceptDepth: sc.conceptDepth ?? sc.scores?.conceptDepth ?? 5,
  };

  // Score all roles
  const scoredRoles = ROLE_DATABASE.map((role) => {
    const skillMatch = computeSkillMatch(scores, role);
    const levelMatch = computeLevelMatch(overall, role.level, sessionDifficulty);
    const preferenceMatch = computePreferenceMatch(userPreferences, role.category, role.title);
    const resumeMatch = computeResumeMatch(resumeText, role);

    const matchScore = parseFloat((
      skillMatch * WEIGHTS.skillMatch +
      levelMatch * WEIGHTS.levelMatch +
      preferenceMatch * WEIGHTS.preferenceMatch +
      resumeMatch * WEIGHTS.resumeMatch
    ).toFixed(3));

    return { role, matchScore, breakdown: { skillMatch, levelMatch, preferenceMatch, resumeMatch } };
  });

  // Top 5 above threshold 0.4, sorted by match
  const topRoles = scoredRoles
    .filter((r) => r.matchScore >= 0.4)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5);

  // AI-enrich in parallel (fail-safe: gracefully degrade)
  const enriched = await Promise.all(
    topRoles.map(async ({ role, matchScore, breakdown }) => {
      let description = `Strong match for ${role.title} based on your interview performance.`;
      let whyMatch = `Your profile aligns well with the ${role.category} requirements.`;
      let tips: string[] = [];

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
        }>(messages, { temperature: 0.4, maxTokens: 500 });

        description = enrichment.description ?? description;
        whyMatch = enrichment.whyMatch ?? whyMatch;
        tips = enrichment.tips ?? [];
      } catch (err) {
        logger.warn({ err, roleId: role.id }, 'AI enrichment failed — using defaults');
      }

      return {
        roleId: role.id,
        title: role.title,
        category: role.category,
        level: role.level,
        description,
        whyMatch,
        requiredSkills: role.skills,
        matchScore,
        breakdown,
        explanation: [`${role.title} matches your ${sessionDifficulty} level profile`],
        studyResources: [],
        interviewTips: tips,
        salaryRange: role.salaryRange,
        growthPath: role.growthPath ?? [],
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

// ── Get recommendations ───────────────────────────────────────
export const getRecommendations = async (sessionId: string, userId: string) => {
  const rec = await RecommendedRole.findOne({ sessionId, userId }).lean();
  if (!rec) throw createError('Recommendations not found', 404, 'RECOMMENDATIONS_NOT_FOUND');
  return rec;
};

// ── Submit feedback on a recommended role ────────────────────
export const submitFeedback = async (params: {
  userId: string;
  sessionId: string;
  roleTitle: string;
  roleCategory: string;
  roleLevel: string;
  signal: 'relevant' | 'not_relevant' | 'applied' | 'saved';
  matchScore: number;
}) => {
  const { userId, sessionId, roleTitle, roleCategory, roleLevel, signal, matchScore } = params;
  const fb = await RoleFeedback.findOneAndUpdate(
    { userId, sessionId, roleTitle },
    { $set: { roleCategory, roleLevel, signal, matchScore } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  logger.info({ userId, sessionId, roleTitle, signal }, 'Role feedback recorded');
  return fb;
};

// ── Custom recommendation (no session required) ───────────────
export const getCustomRecommendations = async (
  userId: string,
  skills: string[],
  preferredLevel?: string,
  preferredCategories?: string[]
) => {
  const user = await User.findById(userId).lean();

  const syntheticScores: Record<string, number> = {
    technical: 6, problemSolving: 6, communication: 6, confidence: 6, conceptDepth: 6,
  };

  const filtered = ROLE_DATABASE.filter((r) => {
    if (preferredLevel && r.level !== preferredLevel) return false;
    if (preferredCategories?.length && !preferredCategories.includes(r.category)) return false;
    return true;
  });

  const scored = filtered.map((role) => {
    const skillMatch = computeSkillMatch(syntheticScores, role);
    const preferenceMatch = computePreferenceMatch((user as any)?.rolePreferences ?? [], role.category, role.title);
    const levelMatch = preferredLevel === role.level ? 1 : 0.5;
    const resumeMatch = computeResumeMatch((user as any)?.resumeText, role);

    const matchScore = parseFloat((
      skillMatch * WEIGHTS.skillMatch +
      levelMatch * WEIGHTS.levelMatch +
      preferenceMatch * WEIGHTS.preferenceMatch +
      resumeMatch * WEIGHTS.resumeMatch
    ).toFixed(3));

    return { role, matchScore };
  });

  return scored
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 8)
    .map(({ role, matchScore }) => ({
      title: role.title,
      category: role.category,
      level: role.level,
      matchScore,
      salaryRange: role.salaryRange,
      growthPath: role.growthPath,
    }));
};