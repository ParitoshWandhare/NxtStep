import { Scorecard, IScorecard } from '../models/Scorecard';
import { RecommendedRole, IRoleMatch } from '../models/RecommendedRole';
import { User } from '../models/User';
import { InterviewSession } from '../models/InterviewSession';
import { aiAdapter } from '../ai/aiAdapter';
import { buildRoleDescriptionPrompt } from '../ai/prompts';
import { redisClient } from '../config/redis';
import { logger } from '../utils/logger';
import { notifyRecommendationsReady } from '../sockets';
import { ROLE_DATABASE } from '../data/roleDatabase';

export interface RoleTemplate {
  title: string;
  category: string;
  level: string;
  skills: { name: string; weight: number }[];
  responsibilities: string[];
  minThresholds: {
    technical: number;
    problemSolving: number;
    communication: number;
  };
}

const WEIGHTS = { skillMatch: 0.5, levelMatch: 0.2, preferenceMatch: 0.15, resumeMatch: 0.15 };

export const computeRecommendations = async (
  sessionId: string,
  userId: string
): Promise<void> => {
  const [scorecard, user, session] = await Promise.all([
    Scorecard.findOne({ sessionId }),
    User.findById(userId),
    InterviewSession.findById(sessionId),
  ]);

  if (!scorecard || !user || !session) {
    throw new Error(`Missing data for recommendations: session=${sessionId}`);
  }

  const candidateSkills = mapScorecardToSkills(scorecard);
  const roles = ROLE_DATABASE;
  const sessionLevel = session.difficulty;

  // Step 1: Filter roles that meet minimum thresholds
  const filtered = roles.filter((role) => passesThreshold(role, scorecard));

  // Step 2: Score and rank
  const scored: Array<{ role: RoleTemplate; score: number; explanation: string[] }> = [];

  for (const role of filtered) {
    const skillMatch = computeSkillOverlap(candidateSkills, role.skills);
    const levelMatch = role.level === sessionLevel ? 1.0 : role.level === 'mid' ? 0.6 : 0.3;
    const preferenceMatch = user.rolePreferences.some(
      (p) => role.category.toLowerCase().includes(p.toLowerCase())
    ) ? 1.0 : 0;

    // Simple resume keyword match (without embeddings for now)
    const resumeMatch = computeResumeMatch(user.resumeText || '', role);

    const matchScore = round2(
      (WEIGHTS.skillMatch * skillMatch +
        WEIGHTS.levelMatch * levelMatch +
        WEIGHTS.preferenceMatch * preferenceMatch +
        WEIGHTS.resumeMatch * resumeMatch) * 100
    );

    const explanation = buildExplanation(scorecard, role, skillMatch, preferenceMatch);

    scored.push({ role, score: matchScore, explanation });
  }

  // Sort by score descending, take top 5
  const top = scored.sort((a, b) => b.score - a.score).slice(0, 5);

  // Enrich with AI-generated descriptions (cached)
  const enrichedRoles: IRoleMatch[] = await Promise.all(
    top.map(async ({ role, score, explanation }) => {
      const enriched = await enrichRole(role);
      return {
        title: role.title,
        category: role.category,
        level: role.level,
        description: enriched.description,
        requiredSkills: role.skills,
        matchScore: score,
        explanation,
        studyResources: [],
        interviewTips: enriched.interviewTips,
      };
    })
  );

  const recommendation = await RecommendedRole.findOneAndUpdate(
    { sessionId },
    { sessionId, userId, roles: enrichedRoles },
    { upsert: true, new: true }
  );

  logger.info(`Recommendations computed: session=${sessionId} count=${enrichedRoles.length}`);

  try {
    notifyRecommendationsReady(sessionId, recommendation.toJSON());
  } catch {
    // Socket might not be initialized
  }
};

export const getRecommendations = async (sessionId: string, userId: string) => {
  const session = await InterviewSession.findOne({ _id: sessionId, userId });
  if (!session) throw Object.assign(new Error('Session not found'), { statusCode: 404 });

  const rec = await RecommendedRole.findOne({ sessionId });
  if (!rec) throw Object.assign(new Error('Recommendations not ready yet'), { statusCode: 404 });
  return rec;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mapScorecardToSkills = (scorecard: IScorecard): Record<string, number> => ({
  technical: scorecard.technical / 10,
  problem_solving: scorecard.problemSolving / 10,
  communication: scorecard.communication / 10,
  confidence: scorecard.confidence / 10,
  concept_depth: scorecard.conceptDepth / 10,
});

const passesThreshold = (role: RoleTemplate, scorecard: IScorecard): boolean => {
  const t = role.minThresholds;
  return (
    scorecard.technical >= t.technical &&
    scorecard.problemSolving >= t.problemSolving &&
    scorecard.communication >= t.communication
  );
};

const computeSkillOverlap = (
  candidateSkills: Record<string, number>,
  roleSkills: { name: string; weight: number }[]
): number => {
  if (roleSkills.length === 0) return 0;
  let total = 0;
  let weightSum = 0;
  for (const skill of roleSkills) {
    const normalizedName = skill.name.toLowerCase().replace(/[^a-z]/g, '_');
    const candidateLevel = candidateSkills[normalizedName] ?? candidateSkills.technical ?? 0;
    total += candidateLevel * skill.weight;
    weightSum += skill.weight;
  }
  return weightSum > 0 ? Math.min(total / weightSum, 1) : 0;
};

const computeResumeMatch = (resumeText: string, role: RoleTemplate): number => {
  if (!resumeText) return 0;
  const resumeLower = resumeText.toLowerCase();
  const skillNames = role.skills.map((s) => s.name.toLowerCase());
  const matches = skillNames.filter((s) => resumeLower.includes(s)).length;
  return matches / Math.max(skillNames.length, 1);
};

const buildExplanation = (
  scorecard: IScorecard,
  role: RoleTemplate,
  skillMatch: number,
  preferenceMatch: number
): string[] => {
  const explanations: string[] = [];

  if (scorecard.technical >= 7) {
    explanations.push(`Strong technical score (${scorecard.technical}/10) matches core requirements`);
  }
  if (scorecard.communication >= 7) {
    explanations.push(`Good communication skills (${scorecard.communication}/10)`);
  }
  if (skillMatch >= 0.7) {
    explanations.push(`High skill overlap with ${role.title} requirements`);
  }
  if (preferenceMatch === 1) {
    explanations.push(`Matches your stated role preferences`);
  }
  if (scorecard.problemSolving >= 6) {
    explanations.push(`Problem-solving score (${scorecard.problemSolving}/10) suits this role`);
  }

  return explanations.length > 0 ? explanations : [`Overall profile matches ${role.title}`];
};

const enrichRole = async (role: RoleTemplate): Promise<{ description: string; interviewTips: string[] }> => {
  const cacheKey = `role_enrichment:${role.title.replace(/\s/g, '_')}`;

  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {
    // Redis might not be available
  }

  try {
    const { system, user } = buildRoleDescriptionPrompt({
      title: role.title,
      skills: role.skills.map((s) => s.name),
    });
    const result = await aiAdapter.sendJSON<{
      description: string;
      skills: string[];
      interviewTips: string[];
    }>([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ], { maxTokens: 300 });

    const enriched = {
      description: result.description || '',
      interviewTips: result.interviewTips || [],
    };

    try {
      await redisClient.setEx(cacheKey, 60 * 60 * 24, JSON.stringify(enriched)); // 24h cache
    } catch {
      // Redis might not be available
    }

    return enriched;
  } catch (err) {
    logger.warn(`Failed to enrich role ${role.title}:`, err);
    return { description: `${role.title} role in ${role.category}`, interviewTips: [] };
  }
};

const round2 = (n: number) => Math.round(n * 100) / 100;