import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequestOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}

export interface AIResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

class AIAdapter {
  private baseUrl: string;
  private apiKey: string;
  private defaultModel: string;

  constructor() {
    this.baseUrl = env.OPENROUTER_BASE_URL;
    this.apiKey = env.OPENROUTER_API_KEY || '';
    this.defaultModel = env.OPENROUTER_DEFAULT_MODEL;
  }

  async send(messages: AIMessage[], options: AIRequestOptions = {}): Promise<AIResponse> {
    const model = options.model || this.defaultModel;
    const maxTokens = options.maxTokens || 1000;
    const temperature = options.temperature ?? 0.7;

    if (!this.apiKey) {
      logger.warn('No OPENROUTER_API_KEY set — returning mock AI response');
      return this.mockResponse(messages, model);
    }

    try {
      const requestBody: Record<string, unknown> = {
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
      };

      if (options.jsonMode) {
        requestBody.response_format = { type: 'json_object' };
      }

      const response = await axios.post(`${this.baseUrl}/chat/completions`, requestBody, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://nxtstep.app',
          'X-Title': 'NxtStep Interview Platform',
        },
        timeout: 30000,
      });

      const choice = response.data.choices?.[0];
      const content = choice?.message?.content || '';
      const usage = response.data.usage;

      return {
        content,
        model,
        usage: usage
          ? {
              promptTokens: usage.prompt_tokens,
              completionTokens: usage.completion_tokens,
              totalTokens: usage.total_tokens,
            }
          : undefined,
      };
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number; data?: unknown }; message?: string };
      logger.error('AI adapter error:', {
        status: axiosError.response?.status,
        data: axiosError.response?.data,
        message: axiosError.message,
      });
      throw new Error(`AI request failed: ${axiosError.message || 'Unknown error'}`);
    }
  }

  async sendJSON<T>(messages: AIMessage[], options: AIRequestOptions = {}): Promise<T> {
    const response = await this.send(messages, { ...options, jsonMode: true });
    try {
      const cleaned = response.content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      return JSON.parse(cleaned) as T;
    } catch {
      logger.error('Failed to parse AI JSON response:', response.content);
      throw new Error('AI returned invalid JSON');
    }
  }

  // Mock response for development without API key
  private mockResponse(messages: AIMessage[], model: string): AIResponse {
    const lastMessage = messages[messages.length - 1]?.content || '';

    // Detect what type of request based on message content
    if (lastMessage.includes('interview question') || lastMessage.includes('Create ONE question')) {
      return {
        content: JSON.stringify({
          id: `q_mock_${Date.now()}`,
          text: 'Can you explain how React hooks work and give an example of useState?',
          type: 'concept',
          expectedKeywords: ['useState', 'functional component', 'state', 'render'],
          difficulty: 'mid',
        }),
        model,
      };
    }

    if (lastMessage.includes('evaluator') || lastMessage.includes('Score the candidate')) {
      return {
        content: JSON.stringify({
          scores: {
            technical: 7,
            communication: 8,
            problemSolving: 6,
            confidence: 7,
            conceptDepth: 6,
          },
          strengths: ['Clear explanation', 'Good examples'],
          weaknesses: ['Could explain lifecycle more'],
          improvements: ['Read more about useEffect dependencies'],
          shouldAskFollowUp: false,
          missingKeywords: ['useEffect', 'cleanup'],
        }),
        model,
      };
    }

    if (lastMessage.includes('follow-up') || lastMessage.includes('Generate ONE follow-up')) {
      return {
        content: JSON.stringify({
          text: 'Can you explain the difference between useEffect with an empty dependency array versus no dependency array?',
        }),
        model,
      };
    }

    if (lastMessage.includes('job description') || lastMessage.includes('role description')) {
      return {
        content: JSON.stringify({
          description: 'Build modern web applications using React and TypeScript in an agile team.',
          skills: ['React', 'TypeScript', 'CSS', 'REST APIs', 'Git'],
          interviewTips: [
            'Practice React hooks thoroughly',
            'Know your JavaScript fundamentals',
            'Be ready for component architecture questions',
          ],
        }),
        model,
      };
    }

    return { content: 'Mock AI response', model };
  }
}

export const aiAdapter = new AIAdapter();