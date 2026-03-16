// ============================================================
// NxtStep — Prompt Library v2.0
// Versioned, few-shot calibrated prompts for all AI tasks.
// All prompts return { system, user } for aiAdapter.send().
// ============================================================

export const PROMPT_VERSION = '2.0';

// ─── Role Topic Taxonomy ──────────────────────────────────────

export const ROLE_TOPICS: Record<string, string[]> = {
  frontend:   ['React', 'JavaScript', 'CSS', 'TypeScript', 'performance', 'accessibility', 'browser APIs', 'bundling'],
  backend:    ['Node.js', 'REST APIs', 'databases', 'caching', 'authentication', 'system design', 'microservices', 'queues'],
  fullstack:  ['React', 'Node.js', 'databases', 'REST APIs', 'deployment', 'TypeScript', 'system design', 'state management'],
  data:       ['SQL', 'data modeling', 'ETL pipelines', 'pandas', 'data warehousing', 'visualization', 'Spark', 'dbt'],
  ml:         ['machine learning', 'neural networks', 'model evaluation', 'feature engineering', 'PyTorch', 'LLMs', 'transformers'],
  devops:     ['CI/CD', 'Docker', 'Kubernetes', 'cloud infrastructure', 'monitoring', 'IaC', 'SRE', 'observability'],
  mobile:     ['React Native', 'mobile UX', 'state management', 'offline support', 'native modules', 'Swift', 'Kotlin'],
  qa:         ['test automation', 'Playwright', 'API testing', 'test strategy', 'CI integration', 'performance testing'],
  security:   ['OWASP', 'penetration testing', 'secure code review', 'IAM', 'cryptography', 'threat modeling'],
};

// ─── Few-Shot Calibration ─────────────────────────────────────

const EVAL_FEW_SHOT = `
CALIBRATION EXAMPLE 1:
Question: What is the difference between null and undefined in JavaScript?
Answer: "null is set by the developer explicitly. undefined means a variable was declared but not yet assigned a value."
Output: {
  "scores": {"technical":6,"communication":8,"problemSolving":5,"confidence":7,"conceptDepth":5},
  "strengths": ["Clear distinction", "Good verbal clarity"],
  "weaknesses": ["No mention of typeof null === 'object' quirk", "Missing nullish coalescing"],
  "improvements": ["Study typeof behaviour", "Learn ?? operator"],
  "shouldAskFollowUp": true,
  "missingKeywords": ["typeof null", "nullish coalescing", "void 0"],
  "detectedKeywords": ["null", "undefined", "declared"]
}

CALIBRATION EXAMPLE 2:
Question: Explain event delegation in the browser DOM.
Answer: "Event delegation leverages bubbling. You attach one listener to a parent instead of many children. You use event.target to identify the element clicked. This works for dynamically added elements and improves performance."
Output: {
  "scores": {"technical":9,"communication":9,"problemSolving":8,"confidence":9,"conceptDepth":8},
  "strengths": ["Accurate explanation", "Mentioned dynamic elements and performance"],
  "weaknesses": ["Could mention capture phase"],
  "improvements": ["Learn addEventListener third argument for capture phase"],
  "shouldAskFollowUp": false,
  "missingKeywords": ["capture phase"],
  "detectedKeywords": ["bubbling", "event.target", "performance", "dynamic elements"]
}`.trim();

// ─── Question Generation ──────────────────────────────────────

export function buildQuestionGenerationPrompt(params: {
  role: string;
  level: string;
  topic: string;
  previousQuestions: string[];
  seed: string;
}): { system: string; user: string } {
  const { role, level, topic, previousQuestions, seed } = params;
  const avoidList = previousQuestions.length
    ? `\nAVOID topics already covered: ${previousQuestions.join(', ')}`
    : '';

  return {
    system: `You are a senior technical interviewer conducting structured interviews.
Questions must be clear, focused, and calibrated to the candidate level.
Respond with a single valid JSON object — no prose, no markdown fences.`,
    user: `Generate ONE interview question.

Role: ${role}
Level: ${level}
Focus Topic: ${topic}
Seed (for uniqueness): ${seed}${avoidList}

Return ONLY this JSON:
{
  "id": "<unique string>",
  "text": "<question text>",
  "type": "concept" | "problem" | "behavioral",
  "expectedKeywords": ["keyword1", "keyword2", "keyword3"],
  "difficulty": "${level}"
}`,
  };
}

// ─── Follow-up Generation ─────────────────────────────────────

export function buildFollowUpPrompt(params: {
  originalQuestion: string;
  candidateAnswer: string;
  missingKeywords: string[];
  weaknesses: string[];
}): { system: string; user: string } {
  const { originalQuestion, candidateAnswer, missingKeywords, weaknesses } = params;
  return {
    system: `You are a senior technical interviewer.
Generate targeted follow-up questions that probe exactly what the candidate missed.
Keep follow-ups concise (1–2 sentences). Respond with a single valid JSON object.`,
    user: `Original Question: "${originalQuestion}"

Candidate's Answer: "${candidateAnswer}"

Missing Areas: ${missingKeywords.join(', ')}
Identified Weaknesses: ${weaknesses.join(', ')}

Generate ONE follow-up question targeting these gaps.

Return ONLY this JSON:
{
  "text": "<follow-up question>",
  "targetKeywords": ["keyword1", "keyword2"]
}`,
  };
}

// ─── Answer Evaluation ────────────────────────────────────────

export function buildEvaluationPrompt(params: {
  question: string;
  answer: string;
  expectedKeywords: string[];
  role: string;
  level: string;
}): { system: string; user: string } {
  const { question, answer, expectedKeywords, role, level } = params;
  return {
    system: `You are a strict but fair technical evaluator for ${role} candidates at ${level} level.
Score on 0–10 scales: 0=completely wrong, 5=adequate, 10=exemplary.
Be consistent — use the calibration examples as your benchmark.
Respond with a single valid JSON object — no markdown, no prose.

${EVAL_FEW_SHOT}`,
    user: `Evaluate this interview answer.

Question: "${question}"
Expected Keywords (reference only): ${expectedKeywords.join(', ')}
Candidate's Answer: "${answer}"

Return ONLY this JSON:
{
  "scores": {
    "technical": <0-10>,
    "communication": <0-10>,
    "problemSolving": <0-10>,
    "confidence": <0-10>,
    "conceptDepth": <0-10>
  },
  "detectedKeywords": ["<found keywords>"],
  "missingKeywords": ["<expected but not found>"],
  "strengths": ["<strength 1>", "<strength 2>"],
  "weaknesses": ["<weakness 1>"],
  "improvements": ["<actionable tip>"],
  "shouldAskFollowUp": <true|false>,
  "followUpReason": "<why or why not>"
}`,
  };
}

// ─── Role Enrichment ──────────────────────────────────────────

export function buildRoleDescriptionPrompt(params: {
  title: string;
  skills: string[];
  scorecard?: Record<string, number>;
}): { system: string; user: string } {
  const { title, skills, scorecard } = params;
  const scorecardStr = scorecard
    ? `\nCandidate scorecard: ${JSON.stringify(scorecard)}`
    : '';

  return {
    system: `You are a professional career advisor writing concise, motivating role summaries.
Respond with a single valid JSON object — no markdown, no prose.`,
    user: `Create a description for role: "${title}"
Key skills: ${skills.join(', ')}${scorecardStr}

Return ONLY this JSON:
{
  "description": "<2-sentence job overview>",
  "whyMatch": "<1-sentence why the candidate suits this role>",
  "tips": ["<interview tip 1>", "<interview tip 2>", "<interview tip 3>"]
}`,
  };
}

// ─── News Topic Classification ────────────────────────────────

export function buildNewsClassificationPrompt(params: {
  title: string;
  summary: string;
}): { system: string; user: string } {
  return {
    system: `You classify tech news articles into categories.
Categories: tech, business, finance, ai, startups.
Respond with a single valid JSON object.`,
    user: `Classify this article:
Title: "${params.title}"
Summary: "${params.summary}"

Return ONLY: {"category": "<one of: tech|business|finance|ai|startups>", "tags": ["<tag1>", "<tag2>", "<tag3>"]}`,
  };
}
