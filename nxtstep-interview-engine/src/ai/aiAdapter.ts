// ============================================================
// NxtStep Interview Engine — AI Adapter
// Provider-agnostic wrapper for OpenRouter / OpenAI / local LLM
// ============================================================

import crypto from 'crypto';
import {
  AIAdapterOptions,
  AIAdapterResponse,
  AIMessage,
  RawEvaluationOutput,
  RawFollowUpOutput,
  RawQuestionOutput,
} from '../types/interview.types';

const DEFAULT_MODEL = process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini';
const API_BASE     = process.env.AI_BASE_URL ?? 'https://openrouter.ai/api/v1';
const API_KEY      = process.env.OPENROUTER_API_KEY ?? '';

// ─── Mock responses for local dev without API key ────────────

function mockResponse(messages: AIMessage[]): unknown {
  const userContent = messages.find(m => m.role === 'user')?.content ?? '';

  if (userContent.includes('Create ONE question')) {
    return {
      id: `mock_q_${Date.now()}`,
      text: 'Can you explain how React\'s virtual DOM reconciliation works?',
      type: 'concept',
      expectedKeywords: ['virtual DOM', 'diffing', 'fiber', 'reconciliation', 'render'],
      difficulty: 'mid',
    } satisfies RawQuestionOutput;
  }

  if (userContent.includes('follow-up question')) {
    return {
      text: 'Could you elaborate on how React Fiber specifically improves the reconciliation algorithm?',
      targetKeywords: ['fiber', 'priority', 'incremental rendering'],
    } satisfies RawFollowUpOutput;
  }

  // Evaluation mock
  return {
    scores: {
      technical:      7,
      communication:  6,
      problemSolving: 6,
      confidence:     7,
      conceptDepth:   5,
    },
    strengths:         ['Good high-level understanding', 'Clear communication'],
    weaknesses:        ['Missed fiber architecture details'],
    improvements:      ['Study React Fiber scheduling model'],
    shouldAskFollowUp: true,
    missingKeywords:   ['fiber', 'priority lanes', 'concurrent mode'],
    detectedKeywords:  ['virtual DOM', 'diffing', 'reconciliation'],
  } satisfies RawEvaluationOutput;
}

// ─── Core adapter ────────────────────────────────────────────

async function send<T>(
  messages: AIMessage[],
  options: AIAdapterOptions = {},
): Promise<AIAdapterResponse<T>> {
  const startTime = Date.now();

  // Hash the prompt for reproducibility / auditing
  const promptHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(messages))
    .digest('hex')
    .slice(0, 12);

  // Dev fallback — no API key
  if (!API_KEY) {
    console.warn('[AIAdapter] No API key — using mock response');
    await new Promise(r => setTimeout(r, 120)); // simulate latency
    return {
      data:      mockResponse(messages) as T,
      promptHash,
      latencyMs: Date.now() - startTime,
      model:     'mock',
    };
  }

  const body = {
    model:       options.model ?? DEFAULT_MODEL,
    max_tokens:  options.maxTokens ?? 1000,
    temperature: options.temperature ?? 0.4,
    messages,
  };

  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      Authorization:   `Bearer ${API_KEY}`,
      'HTTP-Referer':  'https://nxtstep.app',
      'X-Title':       'NxtStep Interview Engine',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AIAdapter HTTP ${res.status}: ${err}`);
  }

  const json = await res.json() as { choices: Array<{ message: { content: string } }>; model: string };
  const raw  = json.choices[0]?.message?.content ?? '';

  let parsed: T;
  try {
    // Strip possible ```json fences
    const clean = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    parsed = JSON.parse(clean) as T;
  } catch {
    throw new Error(`AIAdapter: failed to parse JSON response:\n${raw}`);
  }

  return {
    data:      parsed,
    promptHash,
    latencyMs: Date.now() - startTime,
    model:     json.model ?? body.model,
  };
}

// ─── Typed convenience wrappers ──────────────────────────────

export const aiAdapter = {
  send,

  async sendJSON<T>(messages: AIMessage[], options?: AIAdapterOptions): Promise<AIAdapterResponse<T>> {
    return send<T>(messages, options);
  },

  buildMessages(system: string, user: string): AIMessage[] {
    return [
      { role: 'system', content: system },
      { role: 'user',   content: user },
    ];
  },
};
