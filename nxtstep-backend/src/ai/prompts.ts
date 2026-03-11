// Prompt Library v1.0 — NxtStep Interview Engine
// All prompts are versioned. Increment version when changing prompts
// to preserve reproducibility of historical evaluations.

export const PROMPT_VERSION = '1.0';

// ─── Question Generation ────────────────────────────────────────────────────

export const buildQuestionGenerationPrompt = (params: {
  role: string;
  level: string;
  topic: string;
  previousQuestions?: string[];
  seed?: string;
}) => {
  const avoidList =
    params.previousQuestions?.length
      ? `\nDo NOT ask these questions again:\n${params.previousQuestions.map((q) => `- ${q}`).join('\n')}`
      : '';

  return {
    system: `You are an experienced senior technical interviewer conducting a structured interview. 
You create precise, clear questions appropriate for the role and level provided.
Always return valid JSON only — no markdown, no extra text.`,
    user: `Create ONE interview question.
Role: ${params.role}
Level: ${params.level}
Focus Topic: ${params.topic}
Seed: ${params.seed || Date.now()}
${avoidList}

Return JSON:
{
  "id": "q_<unique_id>",
  "text": "<the question>",
  "type": "concept|problem|behavioral",
  "expectedKeywords": ["keyword1", "keyword2"],
  "difficulty": "junior|mid|senior"
}`,
  };
};

// ─── Follow-up Generation ────────────────────────────────────────────────────

export const buildFollowUpPrompt = (params: {
  originalQuestion: string;
  candidateAnswer: string;
  missingKeywords: string[];
  weaknesses: string[];
}) => {
  return {
    system: `You are a technical interviewer generating targeted follow-up questions.
The follow-up should probe a specific missing area — keep it concise (1-2 sentences).
Always return valid JSON only.`,
    user: `Original Question: ${params.originalQuestion}
Candidate's Answer: ${params.candidateAnswer}
Missing Areas: ${params.missingKeywords.join(', ')}
Weaknesses Identified: ${params.weaknesses.join(', ')}

Generate ONE follow-up question to probe the missing area.

Return JSON:
{
  "text": "<the follow-up question>"
}`,
  };
};

// ─── Answer Evaluation ───────────────────────────────────────────────────────

export const buildEvaluationPrompt = (params: {
  question: string;
  answer: string;
  expectedKeywords: string[];
  role: string;
  level: string;
}) => {
  const fewShotExamples = `
EXAMPLE 1:
Question: "What is the difference between let and var in JavaScript?"
Answer: "var is function scoped and hoisted, let is block scoped and not hoisted in the same way."
Output: {"scores":{"technical":8,"communication":8,"problemSolving":5,"confidence":7,"conceptDepth":7},"strengths":["Correct and concise"],"weaknesses":["Did not mention temporal dead zone"],"improvements":["Explain TDZ for let/const"],"shouldAskFollowUp":false,"missingKeywords":["temporal dead zone","TDZ"]}

EXAMPLE 2:
Question: "Explain async/await in JavaScript."
Answer: "It makes code faster."
Output: {"scores":{"technical":2,"communication":4,"problemSolving":2,"confidence":3,"conceptDepth":2},"strengths":[],"weaknesses":["Extremely vague","No technical detail"],"improvements":["Explain Promises","Explain event loop relationship"],"shouldAskFollowUp":true,"missingKeywords":["Promise","async","await","event loop"]}
`;

  return {
    system: `You are a strict but fair technical evaluator for ${params.role} candidates.
Score on a 0-10 scale per category. Be consistent with the examples.
Always return valid JSON only — no markdown, no extra text.`,
    user: `${fewShotExamples}

Now evaluate:
Role: ${params.role}
Level: ${params.level}
Question: ${params.question}
Expected Keywords: ${params.expectedKeywords.join(', ')}
Candidate Answer: ${params.answer}

Return JSON:
{
  "scores": {
    "technical": <0-10>,
    "communication": <0-10>,
    "problemSolving": <0-10>,
    "confidence": <0-10>,
    "conceptDepth": <0-10>
  },
  "detectedKeywords": ["<keywords from expectedKeywords found in answer>"],
  "missingKeywords": ["<expected keywords NOT found>"],
  "strengths": ["<strength 1>", "<strength 2>"],
  "weaknesses": ["<weakness 1>"],
  "improvements": ["<specific improvement suggestion>"],
  "shouldAskFollowUp": <true|false>,
  "followUpReason": "<why follow up is or isn't needed>"
}`,
  };
};

// ─── Role Description Generation ─────────────────────────────────────────────

export const buildRoleDescriptionPrompt = (params: { title: string; skills: string[] }) => {
  return {
    system: `You are a professional job description writer. Return only valid JSON.`,
    user: `Create a concise role description for: ${params.title}
Required skills include: ${params.skills.join(', ')}

Return JSON:
{
  "description": "<3-line job description>",
  "skills": ["skill1", "skill2", "skill3", "skill4", "skill5"],
  "interviewTips": ["tip1", "tip2", "tip3"]
}`,
  };
};