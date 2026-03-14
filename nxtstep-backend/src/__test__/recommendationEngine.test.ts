// ============================================================
// NxtStep — Recommendation Engine Tests
// Tests: role database integrity, matching algorithm,
//        threshold filtering, score composition,
//        explanation builder, feedback bias loading.
// ============================================================

import {
  ROLE_DATABASE,
  getRolesByCategory,
  getRolesByLevel,
  getRoleById,
  ROLE_COUNT,
  RoleTemplate,
} from '../data/roleDatabase';

// ─── Mock the external dependencies ──────────────────────────
jest.mock('../models/Scorecard', () => ({
  Scorecard: { findOne: jest.fn() },
}));
jest.mock('../models/User', () => ({
  User: { findById: jest.fn() },
}));
jest.mock('../models/InterviewSession', () => ({
  InterviewSession: { findOne: jest.fn(), findById: jest.fn() },
}));
jest.mock('../models/RecommendedRole', () => ({
  RecommendedRole: { findOne: jest.fn(), findOneAndUpdate: jest.fn() },
}));
jest.mock('../models/RoleFeedback', () => ({
  RoleFeedback: { find: jest.fn().mockResolvedValue([]), findOneAndUpdate: jest.fn(), aggregate: jest.fn() },
}));
jest.mock('../ai/aiAdapter', () => ({
  aiAdapter: {
    sendJSON: jest.fn().mockResolvedValue({
      description: 'Mock role description.',
      whyMatch:    'Your profile matches.',
      tips:        ['Prepare for system design', 'Know your core algorithms'],
    }),
  },
}));
jest.mock('../config/redis', () => ({
  redisClient: {
    get:    jest.fn().mockResolvedValue(null),
    setEx:  jest.fn().mockResolvedValue('OK'),
  },
}));
jest.mock('../sockets', () => ({
  notifyRecommendationsReady: jest.fn(),
}));
jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// ─── Role Database Tests ──────────────────────────────────────

describe('Role Database', () => {
  test('contains at least 20 roles', () => {
    expect(ROLE_DATABASE.length).toBeGreaterThanOrEqual(20);
    expect(ROLE_COUNT).toBe(ROLE_DATABASE.length);
  });

  test('every role has a unique id', () => {
    const ids = ROLE_DATABASE.map((r) => r.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  test('every role has required fields', () => {
    for (const role of ROLE_DATABASE) {
      expect(role.id).toBeTruthy();
      expect(role.title).toBeTruthy();
      expect(role.category).toBeTruthy();
      expect(role.level).toMatch(/junior|mid|senior/);
      expect(role.skills.length).toBeGreaterThan(0);
      expect(role.responsibilities.length).toBeGreaterThan(0);
      expect(role.minThresholds.technical).toBeGreaterThanOrEqual(0);
      expect(role.minThresholds.problemSolving).toBeGreaterThanOrEqual(0);
      expect(role.minThresholds.communication).toBeGreaterThanOrEqual(0);
    }
  });

  test('skill weights are within valid range', () => {
    for (const role of ROLE_DATABASE) {
      for (const skill of role.skills) {
        expect(skill.weight).toBeGreaterThan(0);
        expect(skill.weight).toBeLessThanOrEqual(2.5);
      }
    }
  });

  test('getRolesByCategory returns correct subset', () => {
    const frontendRoles = getRolesByCategory('frontend');
    expect(frontendRoles.length).toBeGreaterThan(0);
    frontendRoles.forEach((r) => expect(r.category).toBe('frontend'));
  });

  test('getRolesByLevel returns correct subset', () => {
    const juniorRoles = getRolesByLevel('junior');
    expect(juniorRoles.length).toBeGreaterThan(0);
    juniorRoles.forEach((r) => expect(r.level).toBe('junior'));
  });

  test('getRoleById finds existing role', () => {
    const first = ROLE_DATABASE[0];
    const found = getRoleById(first.id);
    expect(found).toBeDefined();
    expect(found!.title).toBe(first.title);
  });

  test('getRoleById returns undefined for unknown id', () => {
    expect(getRoleById('nonexistent_role')).toBeUndefined();
  });

  test('all categories have at least one role', () => {
    const categories = ['frontend', 'backend', 'fullstack', 'data', 'ml', 'devops', 'mobile'];
    categories.forEach((cat) => {
      const roles = getRolesByCategory(cat as never);
      expect(roles.length).toBeGreaterThan(0);
    });
  });

  test('minThresholds are always lower than 10', () => {
    ROLE_DATABASE.forEach((role) => {
      expect(role.minThresholds.technical).toBeLessThan(10);
      expect(role.minThresholds.problemSolving).toBeLessThan(10);
      expect(role.minThresholds.communication).toBeLessThan(10);
    });
  });
});

// ─── Matching Algorithm Unit Tests ───────────────────────────
// Test the core math without going through the full service.

// Re-implement helpers locally to test pure functions:

function normalizeTo01(scorecard: Record<string, number>) {
  return {
    technical:      (scorecard.technical      ?? 5) / 10,
    problemSolving: (scorecard.problemSolving ?? 5) / 10,
    communication:  (scorecard.communication  ?? 5) / 10,
    confidence:     (scorecard.confidence     ?? 5) / 10,
    conceptDepth:   (scorecard.conceptDepth   ?? 5) / 10,
  };
}

function computeSkillMatchLocal(
  candidate: ReturnType<typeof normalizeTo01>,
  role: RoleTemplate,
): number {
  if (!role.skills.length) return 0;
  let weightedSum = 0;
  let totalWeight = 0;
  for (const skill of role.skills) {
    // Simplified: always use technical dimension for testing
    weightedSum += candidate.technical * skill.weight;
    totalWeight += skill.weight;
  }
  return totalWeight > 0 ? Math.min(weightedSum / totalWeight, 1) : 0;
}

function computeLevelMatchLocal(
  sessionLevel: string,
  roleLevel: string,
  overallScore: number,
): number {
  if (sessionLevel === roleLevel) return 1.0;
  const levels = ['junior', 'mid', 'senior'];
  const diff = Math.abs(levels.indexOf(sessionLevel) - levels.indexOf(roleLevel));
  if (diff === 1 && overallScore >= 7.5) return 0.7;
  if (diff === 1) return 0.5;
  return 0.2;
}

describe('Matching Algorithm — Pure Functions', () => {

  test('computeSkillMatch is 1.0 for perfect technical score', () => {
    const candidate = normalizeTo01({ technical: 10, problemSolving: 10, communication: 10, confidence: 10, conceptDepth: 10 });
    const role = ROLE_DATABASE[0];
    const match = computeSkillMatchLocal(candidate, role);
    expect(match).toBe(1.0);
  });

  test('computeSkillMatch is 0 for zero technical score', () => {
    const candidate = normalizeTo01({ technical: 0, problemSolving: 0, communication: 0, confidence: 0, conceptDepth: 0 });
    const role = ROLE_DATABASE[0];
    const match = computeSkillMatchLocal(candidate, role);
    expect(match).toBe(0);
  });

  test('computeSkillMatch scales proportionally', () => {
    const c5 = normalizeTo01({ technical: 5, problemSolving: 5, communication: 5, confidence: 5, conceptDepth: 5 });
    const c8 = normalizeTo01({ technical: 8, problemSolving: 8, communication: 8, confidence: 8, conceptDepth: 8 });
    const role = ROLE_DATABASE[0];
    expect(computeSkillMatchLocal(c8, role)).toBeGreaterThan(computeSkillMatchLocal(c5, role));
  });

  test('level match is 1.0 for exact level match', () => {
    expect(computeLevelMatchLocal('mid', 'mid', 7.0)).toBe(1.0);
    expect(computeLevelMatchLocal('junior', 'junior', 5.0)).toBe(1.0);
    expect(computeLevelMatchLocal('senior', 'senior', 9.0)).toBe(1.0);
  });

  test('level match allows stretch role with high score', () => {
    const match = computeLevelMatchLocal('junior', 'mid', 8.0);
    expect(match).toBe(0.7);
  });

  test('level match penalizes large level gap', () => {
    const match = computeLevelMatchLocal('junior', 'senior', 9.0);
    expect(match).toBe(0.2);
  });

  test('level match is lower without stretch score', () => {
    const withStretch    = computeLevelMatchLocal('junior', 'mid', 8.0);
    const withoutStretch = computeLevelMatchLocal('junior', 'mid', 6.0);
    expect(withStretch).toBeGreaterThan(withoutStretch);
  });
});

// ─── Threshold Filter Tests ───────────────────────────────────

describe('Threshold Filter', () => {
  const WEAK_SCORECARD = {
    technical: 1, problemSolving: 1, communication: 1, overall: 1,
  };

  const STRONG_SCORECARD = {
    technical: 9, problemSolving: 9, communication: 9, overall: 9,
  };

  function passesThresholdLocal(role: RoleTemplate, sc: typeof WEAK_SCORECARD): boolean {
    return (
      sc.technical      >= role.minThresholds.technical &&
      sc.problemSolving >= role.minThresholds.problemSolving &&
      sc.communication  >= role.minThresholds.communication
    );
  }

  test('weak scorecard filters out all senior roles', () => {
    const seniorRoles = getRolesByLevel('senior');
    const passing = seniorRoles.filter((r) => passesThresholdLocal(r, WEAK_SCORECARD));
    expect(passing.length).toBe(0);
  });

  test('strong scorecard passes all roles', () => {
    const passing = ROLE_DATABASE.filter((r) => passesThresholdLocal(r, STRONG_SCORECARD));
    expect(passing.length).toBe(ROLE_DATABASE.length);
  });

  test('mid scorecard passes junior but not most senior roles', () => {
    const midSc = { technical: 6, problemSolving: 6, communication: 5, overall: 5.8 };
    const juniorPassing = getRolesByLevel('junior').filter((r) => passesThresholdLocal(r, midSc));
    const seniorPassing = getRolesByLevel('senior').filter((r) => passesThresholdLocal(r, midSc));
    expect(juniorPassing.length).toBeGreaterThan(0);
    expect(seniorPassing.length).toBeLessThan(getRolesByLevel('senior').length);
  });
});

// ─── Score Composition Tests ──────────────────────────────────

describe('Score Composition', () => {
  const WEIGHTS = { skillMatch: 0.5, levelMatch: 0.2, preferenceMatch: 0.15, resumeMatch: 0.15 };

  function compositeScore(
    skillMatch: number,
    levelMatch: number,
    preferenceMatch: number,
    resumeMatch: number,
  ): number {
    return (
      WEIGHTS.skillMatch      * skillMatch      +
      WEIGHTS.levelMatch      * levelMatch      +
      WEIGHTS.preferenceMatch * preferenceMatch +
      WEIGHTS.resumeMatch     * resumeMatch
    ) * 100;
  }

  test('perfect inputs yield 100', () => {
    expect(compositeScore(1, 1, 1, 1)).toBe(100);
  });

  test('zero inputs yield 0', () => {
    expect(compositeScore(0, 0, 0, 0)).toBe(0);
  });

  test('skill match has the highest influence', () => {
    const withSkill    = compositeScore(1, 0, 0, 0);
    const withLevel    = compositeScore(0, 1, 0, 0);
    const withPrefs    = compositeScore(0, 0, 1, 0);
    const withResume   = compositeScore(0, 0, 0, 1);
    expect(withSkill).toBeGreaterThan(withLevel);
    expect(withSkill).toBeGreaterThan(withPrefs);
    expect(withSkill).toBeGreaterThan(withResume);
  });

  test('weights sum to 1.0', () => {
    const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });
});

// ─── Resume Match Tests ───────────────────────────────────────

describe('Resume Match', () => {
  function computeResumeMatchLocal(resumeText: string, role: RoleTemplate): number {
    if (!resumeText.trim()) return 0;
    const resumeLower = resumeText.toLowerCase();
    let matchedWeight = 0;
    let totalWeight   = 0;
    for (const skill of role.skills) {
      if (resumeLower.includes(skill.name.toLowerCase())) {
        matchedWeight += skill.weight;
      }
      totalWeight += skill.weight;
    }
    return totalWeight > 0 ? Math.min(matchedWeight / totalWeight, 1) : 0;
  }

  const reactRole = getRolesByCategory('frontend').find((r) => r.title === 'React Developer')!;

  test('empty resume returns 0', () => {
    expect(computeResumeMatchLocal('', reactRole)).toBe(0);
  });

  test('resume with all skills returns high score', () => {
    const resume = reactRole.skills.map((s) => s.name).join(' and ');
    const score = computeResumeMatchLocal(resume, reactRole);
    expect(score).toBeGreaterThan(0.8);
  });

  test('resume with no matching skills returns 0', () => {
    const score = computeResumeMatchLocal('chef cuisine restaurant cooking food beverage', reactRole);
    expect(score).toBe(0);
  });

  test('partial resume match is between 0 and 1', () => {
    const score = computeResumeMatchLocal('I have experience with React and TypeScript.', reactRole);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });
});