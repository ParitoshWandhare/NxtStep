// ============================================================
// NxtStep Interview Engine — Prompt Library  v1.0
// All prompts are versioned and documented for reproducibility.
// Each function returns { system, user } for aiAdapter.send().
// ============================================================

export const PROMPT_VERSION = '1.0';

// ─── Role topic taxonomy ─────────────────────────────────────

export const ROLE_TOPICS: Record<string, string[]> = {
  frontend:   ['react', 'javascript', 'css', 'performance', 'accessibility', 'browser APIs', 'typescript'],
  backend:    ['node.js', 'REST APIs', 'databases', 'caching', 'authentication', 'system design', 'microservices'],
  fullstack:  ['react', 'node.js', 'databases', 'REST APIs', 'deployment', 'typescript', 'system design'],
  data:       ['SQL', 'data modeling', 'ETL pipelines', 'pandas', 'data warehousing', 'visualization'],
  ml:         ['machine learning', 'neural networks', 'model evaluation', 'feature engineering', 'python', 'pytorch'],
  devops:     ['CI/CD', 'docker', 'kubernetes', 'cloud infrastructure', 'monitoring', 'IaC'],
  mobile:     ['react native', 'mobile UX', 'state management', 'offline support', 'native modules'],
};

// ─── Few-shot calibration examples ───────────────────────────

const EVAL_FEW_SHOT = `
EXAMPLE 1
Question: What is the difference between null and undefined in JavaScript?
Answer: null is explicitly set by developers to indicate no value. undefined means a variable was declared but not assigned.
Scores: { technical: 6, communication: 8, problemSolving: 5, confidence: 7, conceptDepth: 5 }
Strengths: ["Clear distinction", "Good communication"]
Weaknesses: ["Did not mention typeof behaviour", "No mention of null coalescing"]
ShouldFollowUp: true
MissingKeywords: ["typeof null === 'object'", "nullish coalescing", "void 0"]

EXAMPLE 2
Question: Explain event delegation in the browser DOM.
Answer: Event delegation uses the bubbling phase. Instead of attaching listeners to every child, you attach one to the parent and use event.target to identify the originating element. It improves performance and works for dynamically added elements.
Scores: { technical: 9, communication: 9, problemSolving: 8, confidence: 9, conceptDepth: 8 }
Strengths: ["Accurate explanation", "Mentioned dynamic elements", "Performance awareness"]
Weaknesses: ["Could mention capture phase"]
ShouldFollowUp: false
MissingKeywords: []
`.trim();

// ─── Prompt builders ─────────────────────────────────────────

/**
 * Generates a single interview question for the given role/level/topic.
 */
export function buildQuestionPrompt(params: {
  role:                string;
  level:               string;
  topic:               string;
  previousQuestions:   string[];
  seed:                string;
}): { system: string; user: string } {
  const { role, level, topic, previousQuestions, seed } = params;

  const system = `You are a senior technical interviewer conducting a structured interview.
Your questions are clear, focused, and calibrated to the candidate's level.
Always respond with a single valid JSON object — no prose, no markdown fences.`;

  const avoidList =
    previousQuestions.length > 0
      ? `\nAVOID these already-asked topics: ${previousQuestions.join(', ')}`
      : '';

  const user = `Generate ONE interview question.

Role: ${role}
Level: ${level}
Focus Topic: ${topic}
Unique seed (for uniqueness): ${seed}${avoidList}

Return ONLY this JSON:
{
  "id": "<unique string>",
  "text": "<question text>",
  "type": "concept" | "problem" | "behavioral",
  "expectedKeywords": ["<keyword1>", "<keyword2>", "..."],
  "difficulty": "${level}"
}`;

  return { system, user };
}

/**
 * Generates a targeted follow-up question when the candidate
 * missed key concepts in their original answer.
 */
export function buildFollowUpPrompt(params: {
  originalQuestion: string;
  candidateAnswer:  string;
  missingKeywords:  string[];
}): { system: string; user: string } {
  const { originalQuestion, candidateAnswer, missingKeywords } = params;

  const system = `You are a senior technical interviewer.
Your follow-up questions are concise (1–2 sentences), targeted, and probe the exact gap in the candidate's knowledge.
Always respond with a single valid JSON object — no prose, no markdown fences.`;

  const user = `The candidate was asked:
"${originalQuestion}"

Their answer:
"${candidateAnswer}"

They failed to mention or explain these key concepts: ${missingKeywords.join(', ')}.

Generate ONE follow-up question that probes this gap.

Return ONLY this JSON:
{
  "text": "<follow-up question>",
  "targetKeywords": ["<keyword1>", "..."]
}`;

  return { system, user };
}

/**
 * Evaluates a candidate's answer against a question,
 * producing per-category scores and actionable feedback.
 */
export function buildEvaluationPrompt(params: {
  question:         string;
  answer:           string;
  expectedKeywords: string[];
  questionType:     string;
}): { system: string; user: string } {
  const { question, answer, expectedKeywords, questionType } = params;

  const system = `You are a strict but fair technical evaluator.
Score answers on 0–10 scales: 0 = completely wrong/absent, 5 = adequate, 10 = exemplary.
Be consistent — use the calibration examples below as your benchmark.
Always respond with a single valid JSON object — no prose, no markdown fences.

CALIBRATION EXAMPLES:
${EVAL_FEW_SHOT}`;

  const user = `Evaluate the following interview answer.

Question (type: ${questionType}):
"${question}"

Candidate's Answer:
"${answer}"

Expected Keywords (not all required, just reference): ${expectedKeywords.join(', ')}

Return ONLY this JSON:
{
  "scores": {
    "technical":      <0–10>,
    "communication":  <0–10>,
    "problemSolving": <0–10>,
    "confidence":     <0–10>,
    "conceptDepth":   <0–10>
  },
  "strengths":         ["<point>", "..."],
  "weaknesses":        ["<point>", "..."],
  "improvements":      ["<actionable tip>", "..."],
  "shouldAskFollowUp": <true|false>,
  "missingKeywords":   ["<keyword>", "..."],
  "detectedKeywords":  ["<keyword>", "..."]
}`;

  return { system, user };
}

/**
 * Generates AI-enriched job description + tips for a matched role.
 * Used by the recommendation engine post-interview.
 */
export function buildRoleEnrichmentPrompt(params: {
  roleName:    string;
  scorecard:   Record<string, number>;
}): { system: string; user: string } {
  const { roleName, scorecard } = params;

  const system = `You are a career advisor providing concise, motivating role summaries.
Always respond with a single valid JSON object — no prose, no markdown fences.`;

  const user = `The candidate matched the role: "${roleName}".
Their scorecard: ${JSON.stringify(scorecard)}.

Return ONLY this JSON:
{
  "description": "<2 sentence role overview>",
  "whyMatch": "<1 sentence explaining why this is a good match>",
  "tips": ["<tip1>", "<tip2>", "<tip3>"]
}`;

  return { system, user };
}
