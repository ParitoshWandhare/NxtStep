// ============================================================
// NxtStep — Recommendation Service  v2.0
//
// Pipeline:
//  1. Load scorecard + user profile + session data
//  2. Map scorecard categories → candidate skill strengths
//  3. Filter roles that pass minThresholds
//  4. Compute matchScore = w1·skillMatch + w2·levelMatch
//                        + w3·preferenceMatch + w4·resumeMatch
//  5. Optional semantic resume match via keyword overlap
//  6. Rank, take top-N, enrich with LLM descriptions (cached)
//  7. Persist → notify client via Socket.IO
//
// Feedback loop:
//  - User signals (relevant / not_relevant / applied) stored in
//    RoleFeedback collection and used to adjust per-category
//    threshold biases in future runs.
// ============================================================

import { Scorecard, IScorecard } from '../models/Scorecard';
import { RecommendedRole, IRoleMatch, IRecommendedRole } from '../models/RecommendedRole';
import { RoleFeedback, FeedbackSignal } from '../models/RoleFeedback';
import { User, IUser } from '../models/User';
import { InterviewSession } from '../models/InterviewSession';
import { aiAdapter } from '../ai/aiAdapter';
import { redisClient } from '../config/redis';
import { logger } from '../utils/logger';
import { notifyRecommendationsReady } from '../sockets';
import {
  ROLE_DATABASE,
  RoleTemplate,
  DifficultyLevel,
  RoleCategory,
} from '../data/roleDatabase';

// ─── Matching Weights ─────────────────────────────────────────
// Configurable via env vars; fall back to defaults from spec.

const WEIGHTS = {
  skillMatch:       Number(process.env.WEIGHT_SKILL_MATCH)       || 0.50,
  levelMatch:       Number(process.env.WEIGHT_LEVEL_MATCH)       || 0.20,
  preferenceMatch:  Number(process.env.WEIGHT_PREFERENCE_MATCH)  || 0.15,
  resumeMatch:      Number(process.env.WEIGHT_RESUME_MATCH)      || 0.15,
};

const TOP_N = 5;

// ─── Scorecard → Candidate Skill Map ─────────────────────────

interface CandidateSkills {
  technical:      number;   // 0–1 normalized
  problemSolving: number;
  communication:  number;
  confidence:     number;
  conceptDepth:   number;
}

function normalizeScorecardToSkills(scorecard: IScorecard): CandidateSkills {
  return {
    technical:      scorecard.technical      / 10,
    problemSolving: scorecard.problemSolving / 10,
    communication:  scorecard.communication  / 10,
    confidence:     scorecard.confidence     / 10,
    conceptDepth:   scorecard.conceptDepth   / 10,
  };
}

// Maps a role skill name to the best matching candidate dimension.
// This is the core "skill translation" step from the spec.
function getSkillScore(
  skillName: string,
  candidate: CandidateSkills,
): number {
  const name = skillName.toLowerCase();

  // Technical skills → technical dimension
  if (
    name.match(/react|vue|angular|typescript|javascript|python|node|java|rust|go|sql|mongodb|redis|docker|kubernetes/)
  ) return candidate.technical;

  // Algorithm / logic → problem solving
  if (
    name.match(/algorithm|data structure|system design|architecture|design pattern|distributed|problem/i)
  ) return candidate.problemSolving;

  // Communication → communication dimension
  if (
    name.match(/communication|mentoring|documentation|leadership|presentation|stakeholder|collaboration/i)
  ) return candidate.communication;

  // Deep knowledge → concept depth
  if (
    name.match(/mathematics|statistics|research|deep learning|theory|calculus|linear algebra/i)
  ) return candidate.conceptDepth;

  // Default: average of technical + problem solving
  return (candidate.technical + candidate.problemSolving) / 2;
}

// ─── Step 1: Threshold Filter ─────────────────────────────────

function passesThreshold(
  role: RoleTemplate,
  scorecard: IScorecard,
  feedbackBias: Record<string, number>,
): boolean {
  const t = role.minThresholds;
  const bias = feedbackBias[role.category] ?? 0;

  return (
    scorecard.technical      >= t.technical      - bias &&
    scorecard.problemSolving >= t.problemSolving - bias &&
    scorecard.communication  >= t.communication  - bias
  );
}

// ─── Step 2: Skill Match (0–1) ────────────────────────────────

function computeSkillMatch(
  candidate: CandidateSkills,
  role: RoleTemplate,
): number {
  if (!role.skills.length) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const skill of role.skills) {
    const score = getSkillScore(skill.name, candidate);
    weightedSum += score * skill.weight;
    totalWeight += skill.weight;
  }

  return totalWeight > 0 ? Math.min(weightedSum / totalWeight, 1) : 0;
}

// ─── Step 3: Level Match (0–1) ────────────────────────────────

function computeLevelMatch(
  sessionLevel: DifficultyLevel,
  roleLevel: DifficultyLevel,
  overallScore: number,
): number {
  if (sessionLevel === roleLevel) return 1.0;

  // Allow scoring into the next level if overall is high (≥ 7.5)
  const levels: DifficultyLevel[] = ['junior', 'mid', 'senior'];
  const sessionIdx = levels.indexOf(sessionLevel);
  const roleIdx    = levels.indexOf(roleLevel);
  const diff       = Math.abs(sessionIdx - roleIdx);

  if (diff === 1 && overallScore >= 7.5) return 0.7;
  if (diff === 1) return 0.5;
  return 0.2; // 2 levels apart — low but still possible
}

// ─── Step 4: Preference Match (0–1) ──────────────────────────

function computePreferenceMatch(
  userPreferences: string[],
  roleCategory: RoleCategory,
  roleTitle: string,
): number {
  if (!userPreferences.length) return 0;

  const categoryLower = roleCategory.toLowerCase();
  const titleLower    = roleTitle.toLowerCase();

  const hit = userPreferences.some(
    (pref) =>
      categoryLower.includes(pref.toLowerCase()) ||
      titleLower.includes(pref.toLowerCase())
  );

  return hit ? 1.0 : 0.0;
}

// ─── Step 5: Resume Match (0–1) ──────────────────────────────

function computeResumeMatch(
  resumeText: string,
  role: RoleTemplate,
): number {
  if (!resumeText?.trim()) return 0;

  const resumeLower = resumeText.toLowerCase();
  const allSkillNames = role.skills.map((s) => s.name.toLowerCase());

  // Weighted by skill weight — highly important skills matched count more
  let matchedWeight = 0;
  let totalWeight   = 0;

  for (const skill of role.skills) {
    if (resumeLower.includes(skill.name.toLowerCase())) {
      matchedWeight += skill.weight;
    }
    totalWeight += skill.weight;
  }

  const baseMatch = totalWeight > 0 ? matchedWeight / totalWeight : 0;

  // Bonus for responsibility keyword matches (0.1 max)
  const respKeywords = role.responsibilities
    .join(' ')
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 5);

  const respHits = respKeywords.filter((kw) => resumeLower.includes(kw)).length;
  const respBonus = Math.min(respHits / Math.max(respKeywords.length, 1), 0.1);

  return Math.min(baseMatch + respBonus, 1);
}

// ─── Step 6: Composite Score ──────────────────────────────────

interface ScoredRole {
  role:        RoleTemplate;
  matchScore:  number;
  breakdown: {
    skillMatch:      number;
    levelMatch:      number;
    preferenceMatch: number;
    resumeMatch:     number;
  };
  explanation: string[];
}

function computeMatchScore(params: {
  role:            RoleTemplate;
  candidate:       CandidateSkills;
  sessionLevel:    DifficultyLevel;
  overallScore:    number;
  userPreferences: string[];
  resumeText:      string;
}): ScoredRole {
  const { role, candidate, sessionLevel, overallScore, userPreferences, resumeText } = params;

  const skillMatch      = computeSkillMatch(candidate, role);
  const levelMatch      = computeLevelMatch(sessionLevel, role.level, overallScore);
  const preferenceMatch = computePreferenceMatch(userPreferences, role.category, role.title);
  const resumeMatch     = computeResumeMatch(resumeText, role);

  const matchScore = round2(
    (WEIGHTS.skillMatch      * skillMatch      +
     WEIGHTS.levelMatch      * levelMatch      +
     WEIGHTS.preferenceMatch * preferenceMatch +
     WEIGHTS.resumeMatch     * resumeMatch) * 100
  );

  const explanation = buildExplanation({
    scorecard: candidate,
    role,
    skillMatch,
    levelMatch,
    preferenceMatch,
    resumeMatch,
  });

  return {
    role,
    matchScore,
    breakdown: { skillMatch, levelMatch, preferenceMatch, resumeMatch },
    explanation,
  };
}

// ─── Explanation Builder ──────────────────────────────────────

function buildExplanation(params: {
  scorecard:        CandidateSkills;
  role:             RoleTemplate;
  skillMatch:       number;
  levelMatch:       number;
  preferenceMatch:  number;
  resumeMatch:      number;
}): string[] {
  const { scorecard, role, skillMatch, levelMatch, preferenceMatch, resumeMatch } = params;
  const bullets: string[] = [];

  if (skillMatch >= 0.75) {
    bullets.push(`Strong technical skills (${pct(skillMatch)}) match ${role.title} requirements`);
  } else if (skillMatch >= 0.5) {
    bullets.push(`Moderate skill overlap (${pct(skillMatch)}) with ${role.title}`);
  }

  if (scorecard.technical >= 0.7) {
    bullets.push(`High technical score aligns with role's core competencies`);
  }

  if (scorecard.communication >= 0.7) {
    bullets.push(`Strong communication skills (${pct(scorecard.communication)}) — valued in this role`);
  }

  if (levelMatch >= 0.9) {
    bullets.push(`Experience level is a direct match for ${role.level} expectations`);
  } else if (levelMatch >= 0.7) {
    bullets.push(`High overall score indicates readiness for ${role.level} responsibilities`);
  }

  if (preferenceMatch === 1) {
    bullets.push(`Matches your stated role preferences`);
  }

  if (resumeMatch >= 0.5) {
    bullets.push(`Resume shows relevant experience for ${role.title}`);
  }

  if (scorecard.problemSolving >= 0.65) {
    bullets.push(`Problem-solving ability supports ${role.responsibilities[0]?.toLowerCase()}`);
  }

  return bullets.length > 0 ? bullets : [`Overall profile aligns with ${role.title}`];
}

// ─── Feedback Bias Loader ────────────────────────────────────
// Aggregate past 'not_relevant' signals to lower thresholds
// for categories where the user's profile was over-penalised.

async function loadFeedbackBias(userId: string): Promise<Record<string, number>> {
  const bias: Record<string, number> = {};

  try {
    const recentFeedback = await RoleFeedback
      .find({ userId, signal: { $in: ['relevant', 'applied', 'saved'] } })
      .limit(50)
      .lean();

    // Each positive signal for a category reduces the threshold by 0.3 (max 1.5)
    for (const fb of recentFeedback) {
      bias[fb.roleCategory] = Math.min(
        (bias[fb.roleCategory] ?? 0) + 0.3,
        1.5,
      );
    }
  } catch (err) {
    logger.warn('[Recommendations] Failed to load feedback bias:', err);
  }

  return bias;
}

// ─── LLM Role Enrichment (cached 24h) ────────────────────────

async function enrichRole(role: RoleTemplate): Promise<{
  description: string;
  whyMatch:    string;
  tips:        string[];
}> {
  const cacheKey = `role_enrichment:v2:${role.id}`;

  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {
    // Redis unavailable — proceed without cache
  }

  try {
    const result = await aiAdapter.sendJSON<{
      description: string;
      whyMatch:    string;
      tips:        string[];
    }>(
      [
        {
          role: 'system',
          content:
            'You are a professional career advisor. Return only valid JSON, no prose, no markdown.',
        },
        {
          role: 'user',
          content: `Create a concise role description for: ${role.title} (${role.level} ${role.category}).
Required skills: ${role.skills.map((s) => s.name).join(', ')}.

Return ONLY this JSON:
{
  "description": "<2-sentence job description>",
  "whyMatch":    "<1-sentence why a candidate in this area would be a good fit>",
  "tips":        ["<interview tip 1>", "<interview tip 2>", "<interview tip 3>"]
}`,
        },
      ],
      { maxTokens: 300, temperature: 0.5 },
    );

    const enriched = {
      description: result.description ?? `${role.title} role in ${role.category}`,
      whyMatch:    result.whyMatch    ?? `Your profile matches the ${role.level} ${role.category} track.`,
      tips:        result.tips        ?? [],
    };

    try {
      await redisClient.setEx(cacheKey, 60 * 60 * 24, JSON.stringify(enriched));
    } catch {
      // Cache write failed — non-fatal
    }

    return enriched;
  } catch (err) {
    logger.warn(`[Recommendations] Enrichment failed for ${role.title}:`, err);
    return {
      description: `${role.title} — a ${role.level} ${role.category} role.`,
      whyMatch:    `Your interview performance is well-suited for this position.`,
      tips:        [],
    };
  }
}

// ─── Main: Compute Recommendations ───────────────────────────

export async function computeRecommendations(
  sessionId: string,
  userId: string,
): Promise<void> {
  logger.info(`[Recommendations] Computing for session=${sessionId} user=${userId}`);

  const [scorecard, user, session] = await Promise.all([
    Scorecard.findOne({ sessionId }),
    User.findById(userId),
    InterviewSession.findById(sessionId),
  ]);

  if (!scorecard) throw new Error(`Scorecard not found for session ${sessionId}`);
  if (!user)      throw new Error(`User ${userId} not found`);
  if (!session)   throw new Error(`Session ${sessionId} not found`);

  const candidate        = normalizeScorecardToSkills(scorecard);
  const sessionLevel     = session.difficulty;
  const overallScore     = scorecard.overall;
  const userPreferences  = user.rolePreferences ?? [];
  const resumeText       = user.resumeText      ?? '';
  const feedbackBias     = await loadFeedbackBias(userId);

  // ── Filter ────────────────────────────────────────────────
  const filtered = ROLE_DATABASE.filter((role) =>
    passesThreshold(role, scorecard, feedbackBias),
  );

  logger.debug(
    `[Recommendations] ${filtered.length}/${ROLE_DATABASE.length} roles passed thresholds`,
  );

  // ── Score ─────────────────────────────────────────────────
  const scored: ScoredRole[] = filtered.map((role) =>
    computeMatchScore({
      role,
      candidate,
      sessionLevel,
      overallScore,
      userPreferences,
      resumeText,
    }),
  );

  // ── Rank & Select Top N ───────────────────────────────────
  const topRoles = scored
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, TOP_N);

  // ── Enrich via LLM ────────────────────────────────────────
  const enrichedRoles: IRoleMatch[] = await Promise.all(
    topRoles.map(async ({ role, matchScore, breakdown, explanation }) => {
      const enriched = await enrichRole(role);
      return {
        roleId:        role.id,
        title:         role.title,
        category:      role.category,
        level:         role.level,
        description:   enriched.description,
        whyMatch:      enriched.whyMatch,
        requiredSkills: role.skills,
        matchScore,
        breakdown,
        explanation,
        studyResources: [],
        interviewTips:  enriched.tips,
        salaryRange:    role.salaryRange,
        growthPath:     role.growthPath ?? [],
      };
    }),
  );

  // ── Persist ───────────────────────────────────────────────
  const existing = await RecommendedRole.findOne({ sessionId });
  const recommendation = await RecommendedRole.findOneAndUpdate(
    { sessionId },
    {
      sessionId,
      userId,
      roles:       enrichedRoles,
      computedAt:  new Date(),
      version:     (existing?.version ?? 0) + 1,
    },
    { upsert: true, new: true },
  );

  logger.info(
    `[Recommendations] Session ${sessionId}: ${enrichedRoles.length} roles, ` +
    `top=${enrichedRoles[0]?.title} (${enrichedRoles[0]?.matchScore}%)`,
  );

  try {
    notifyRecommendationsReady(sessionId, recommendation.toJSON());
  } catch {
    // Socket not initialized in test/worker environments
  }
}

// ─── Get Recommendations (Controller helper) ──────────────────

export async function getRecommendations(
  sessionId: string,
  userId: string,
): Promise<IRecommendedRole> {
  const session = await InterviewSession.findOne({ _id: sessionId, userId });
  if (!session) {
    throw Object.assign(new Error('Session not found'), { statusCode: 404 });
  }

  const rec = await RecommendedRole.findOne({ sessionId });
  if (!rec) {
    throw Object.assign(
      new Error('Recommendations not ready yet. Please try again shortly.'),
      { statusCode: 404 },
    );
  }

  return rec;
}

// ─── Custom Recommendations (ad-hoc / testing) ───────────────
// Accepts scorecard + resume + preferences directly without
// needing a completed session in the database.

export async function getCustomRecommendations(params: {
  userId:      string;
  scorecard:   Partial<IScorecard>;
  resumeText?: string;
  preferences?: string[];
  level?:      DifficultyLevel;
}): Promise<IRoleMatch[]> {
  const { userId, scorecard, resumeText = '', preferences = [], level = 'mid' } = params;

  const partial = {
    technical:      scorecard.technical      ?? 5,
    problemSolving: scorecard.problemSolving ?? 5,
    communication:  scorecard.communication  ?? 5,
    confidence:     scorecard.confidence     ?? 5,
    conceptDepth:   scorecard.conceptDepth   ?? 5,
    overall:        scorecard.overall        ?? 5,
  };

  const candidate    = normalizeScorecardToSkills(partial as IScorecard);
  const feedbackBias = await loadFeedbackBias(userId);

  const filtered = ROLE_DATABASE.filter((role) =>
    passesThreshold(role, partial as IScorecard, feedbackBias),
  );

  const scored = filtered
    .map((role) =>
      computeMatchScore({
        role,
        candidate,
        sessionLevel:    level,
        overallScore:    partial.overall,
        userPreferences: preferences,
        resumeText,
      }),
    )
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, TOP_N);

  const enriched = await Promise.all(
    scored.map(async ({ role, matchScore, breakdown, explanation }) => {
      const enrichment = await enrichRole(role);
      return {
        roleId:         role.id,
        title:          role.title,
        category:       role.category,
        level:          role.level,
        description:    enrichment.description,
        whyMatch:       enrichment.whyMatch,
        requiredSkills: role.skills,
        matchScore,
        breakdown,
        explanation,
        studyResources: [],
        interviewTips:  enrichment.tips,
        salaryRange:    role.salaryRange,
        growthPath:     role.growthPath ?? [],
      } satisfies IRoleMatch;
    }),
  );

  return enriched;
}

// ─── Feedback Loop ────────────────────────────────────────────

export async function recordRoleFeedback(params: {
  userId:     string;
  sessionId:  string;
  roleTitle:  string;
  signal:     FeedbackSignal;
}): Promise<void> {
  const { userId, sessionId, roleTitle, signal } = params;

  // Find role metadata for category + level
  const role = ROLE_DATABASE.find(
    (r) => r.title.toLowerCase() === roleTitle.toLowerCase(),
  );

  const rec = await RecommendedRole.findOne({ sessionId });
  const matchedRole = rec?.roles.find(
    (r) => r.title.toLowerCase() === roleTitle.toLowerCase(),
  );

  await RoleFeedback.findOneAndUpdate(
    { userId, sessionId, roleTitle },
    {
      userId,
      sessionId,
      roleTitle,
      roleCategory: role?.category ?? 'unknown',
      roleLevel:    role?.level    ?? 'mid',
      signal,
      matchScore:   matchedRole?.matchScore ?? 0,
    },
    { upsert: true },
  );

  logger.info(
    `[Recommendations] Feedback recorded: user=${userId} role="${roleTitle}" signal=${signal}`,
  );
}

// ─── Aggregate Feedback Stats (admin / analytics) ────────────

export async function getFeedbackStats(sessionId: string): Promise<{
  total:      number;
  relevant:   number;
  notRelevant: number;
  applied:    number;
  saved:      number;
}> {
  const stats = await RoleFeedback.aggregate([
    { $match: { sessionId } },
    { $group: { _id: '$signal', count: { $sum: 1 } } },
  ]);

  const bySignal = Object.fromEntries(
    stats.map((s: { _id: string; count: number }) => [s._id, s.count]),
  );

  const total = Object.values(bySignal).reduce((a: number, b: unknown) => a + (b as number), 0) as number;

  return {
    total:       total as number,
    relevant:    (bySignal['relevant']     ?? 0) as number,
    notRelevant: (bySignal['not_relevant'] ?? 0) as number,
    applied:     (bySignal['applied']      ?? 0) as number,
    saved:       (bySignal['saved']        ?? 0) as number,
  };
}

// ─── Utils ────────────────────────────────────────────────────

const round2 = (n: number): number => Math.round(n * 100) / 100;
const pct     = (n: number): string  => `${Math.round(n * 100)}%`;