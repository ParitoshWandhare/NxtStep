// ============================================================
// NxtStep — AI Adapter v2.0
// Provider-agnostic wrapper: OpenRouter / OpenAI / local LLM
// Features: retry, circuit breaker, token tracking, audit hash
// ============================================================

import axios, { AxiosError } from 'axios';
import crypto from 'crypto';
import { env } from '../config/env';
import { logger, logAICall } from '../utils/logger';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequestOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
  retries?: number;
  timeoutMs?: number;
}

export interface AIResponse {
  content: string;
  model: string;
  promptHash: string;
  latencyMs: number;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

// ─── Circuit Breaker ──────────────────────────────────────────
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private readonly threshold = 5;
  private readonly cooldownMs = 30_000;

  isOpen(): boolean {
    if (this.failures < this.threshold) return false;
    if (Date.now() - this.lastFailureTime > this.cooldownMs) {
      this.failures = 0;
      return false;
    }
    return true;
  }

  recordFailure() { this.failures++; this.lastFailureTime = Date.now(); }
  recordSuccess() { this.failures = 0; }
}

const cb = new CircuitBreaker();

// ─── Mock Responses ───────────────────────────────────────────
function getMockResponse(messages: AIMessage[]): string {
  const last = messages[messages.length - 1]?.content ?? '';

  if (last.includes('Create ONE question') || last.includes('Generate ONE')) {
    return JSON.stringify({
      id: `q_mock_${Date.now()}`,
      text: 'Can you explain how React hooks work, and compare useState vs useReducer?',
      type: 'concept',
      expectedKeywords: ['useState', 'useReducer', 'functional component', 'state', 'hooks'],
      difficulty: 'mid',
    });
  }
  if (last.includes('follow-up') || last.includes('probe')) {
    return JSON.stringify({
      text: 'When would you choose useReducer over useState, and why?',
      targetKeywords: ['complex state', 'dispatch', 'reducer'],
    });
  }
  if (last.includes('evaluator') || last.includes('Score') || last.includes('Evaluate')) {
    return JSON.stringify({
      scores: { technical: 7, communication: 8, problemSolving: 6, confidence: 7, conceptDepth: 6 },
      strengths: ['Clear explanation', 'Good examples'],
      weaknesses: ['Missed useReducer nuances', 'No mention of useEffect'],
      improvements: ['Study useEffect cleanup', 'Review dependency arrays'],
      shouldAskFollowUp: true,
      missingKeywords: ['useEffect', 'cleanup', 'dependency array'],
      detectedKeywords: ['useState', 'functional component', 'state'],
    });
  }
  if (last.includes('career') || last.includes('role description') || last.includes('job description')) {
    return JSON.stringify({
      description: 'Build modern web apps with React and TypeScript in an agile team.',
      whyMatch: 'Your technical and communication scores align with this role.',
      tips: ['Practice React hooks', 'Study system design', 'Know TypeScript generics'],
    });
  }
  return JSON.stringify({ content: 'Mock AI response' });
}

// ─── Main Adapter ─────────────────────────────────────────────
class AIAdapter {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly defaultModel: string;

  constructor() {
    this.baseUrl = env.OPENROUTER_BASE_URL;
    this.apiKey = env.OPENROUTER_API_KEY || '';
    this.defaultModel = env.OPENROUTER_DEFAULT_MODEL;
  }

  async send(messages: AIMessage[], options: AIRequestOptions = {}): Promise<AIResponse> {
    const startTime = Date.now();
    const model = options.model || this.defaultModel;
    const maxTokens = options.maxTokens || 1000;
    const temperature = options.temperature ?? 0.7;
    const retries = options.retries ?? 3;
    const timeoutMs = options.timeoutMs ?? 30_000;

    const promptHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(messages))
      .digest('hex')
      .slice(0, 12);

    if (!this.apiKey) {
      logger.warn('[AIAdapter] No API key — mock mode');
      await new Promise(r => setTimeout(r, 80));
      return { content: getMockResponse(messages), model: 'mock', promptHash, latencyMs: Date.now() - startTime };
    }

    if (cb.isOpen()) {
      logger.error('[AIAdapter] Circuit breaker OPEN');
      return { content: getMockResponse(messages), model: 'circuit-breaker', promptHash, latencyMs: 0 };
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const body: Record<string, unknown> = { model, messages, max_tokens: maxTokens, temperature };
        if (options.jsonMode) body.response_format = { type: 'json_object' };

        const res = await axios.post(`${this.baseUrl}/chat/completions`, body, {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://nxtstep.app',
            'X-Title': 'NxtStep AI Interview',
          },
          timeout: timeoutMs,
        });

        const content = res.data.choices?.[0]?.message?.content || '';
        const usage = res.data.usage;
        const latencyMs = Date.now() - startTime;
        cb.recordSuccess();
        if (usage) logAICall(model, usage.prompt_tokens, usage.completion_tokens, latencyMs, 'interview');

        return {
          content,
          model: res.data.model || model,
          promptHash,
          latencyMs,
          usage: usage ? { promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens, totalTokens: usage.total_tokens } : undefined,
        };
      } catch (err) {
        const status = (err as AxiosError).response?.status;
        logger.warn(`[AIAdapter] Attempt ${attempt}/${retries} failed (status: ${status}): ${(err as Error).message}`);
        if (status === 401 || status === 403) { cb.recordFailure(); break; }
        if (attempt < retries) await new Promise(r => setTimeout(r, Math.min(1000 * 2 ** attempt, 8000)));
      }
    }

    cb.recordFailure();
    logger.error('[AIAdapter] All retries exhausted — fallback mock');
    return { content: getMockResponse(messages), model: 'fallback', promptHash, latencyMs: Date.now() - startTime };
  }

  async sendJSON<T>(messages: AIMessage[], options: AIRequestOptions = {}): Promise<T & { _promptHash?: string; _latencyMs?: number }> {
    const res = await this.send(messages, { ...options, jsonMode: true });
    try {
      const cleaned = res.content.replace(/^```(?:json)?\n?/g, '').replace(/\n?```$/g, '').trim();
      return { ...(JSON.parse(cleaned) as T), _promptHash: res.promptHash, _latencyMs: res.latencyMs };
    } catch {
      throw new Error(`AI returned invalid JSON: ${res.content.slice(0, 100)}`);
    }
  }

  buildMessages(system: string, user: string): AIMessage[] {
    return [{ role: 'system', content: system }, { role: 'user', content: user }];
  }
}

export const aiAdapter = new AIAdapter();
