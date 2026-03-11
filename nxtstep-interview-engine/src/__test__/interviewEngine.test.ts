// ============================================================
// NxtStep Interview Engine — Unit Tests
// Tests: evaluator normalization, state machine, scoring,
//        follow-up decision, keyword boost.
// ============================================================

import { InterviewStateMachine } from '../services/stateMachine';
import { shouldAskFollowUp } from '../services/answerEvaluator';
import { computeScorecard, classifyScore } from '../services/scoringAggregator';
import { pickTopic } from '../services/questionGenerator';
import {
  EvaluationScores,
  InterviewQuestion,
  QuestionEvaluation,
  SessionContext,
} from '../types/interview.types';

// ─── State Machine Tests ──────────────────────────────────────

describe('InterviewStateMachine', () => {
  test('starts in INIT state', () => {
    const sm = new InterviewStateMachine('sess_001');
    expect(sm.state).toBe('INIT');
  });

  test('allows valid INIT → PREP transition', () => {
    const sm = new InterviewStateMachine('sess_001');
    sm.transition('PREP');
    expect(sm.state).toBe('PREP');
  });

  test('throws on invalid transition', () => {
    const sm = new InterviewStateMachine('sess_001');
    expect(() => sm.transition('TERMINATE')).toThrow('Invalid transition');
  });

  test('follows full happy path', () => {
    const sm = new InterviewStateMachine('sess_002');
    const path: Array<Parameters<typeof sm.transition>[0]> = [
      'PREP', 'GENERATE_Q', 'AWAIT_ANSWER',
      'PROCESS_ANSWER', 'EVALUATE', 'DECIDE_FOLLOWUP',
      'LOOP', 'GENERATE_Q', 'AWAIT_ANSWER',
      'PROCESS_ANSWER', 'EVALUATE', 'DECIDE_FOLLOWUP',
      'TERMINATE', 'AGGREGATE', 'COMPLETE',
    ];
    for (const state of path) {
      sm.transition(state);
    }
    expect(sm.isTerminal()).toBe(true);
  });

  test('isAwaiting() returns true only in AWAIT states', () => {
    const sm = new InterviewStateMachine('sess_003', 'AWAIT_ANSWER');
    expect(sm.isAwaiting()).toBe(true);
    sm.transition('PROCESS_ANSWER');
    expect(sm.isAwaiting()).toBe(false);
  });
});

// ─── Follow-up Decision Tests ─────────────────────────────────

describe('shouldAskFollowUp', () => {
  const lowScores: EvaluationScores = {
    technical: 4, communication: 6, problemSolving: 5,
    confidence: 3, conceptDepth: 3,
  };
  const highScores: EvaluationScores = {
    technical: 9, communication: 8, problemSolving: 8,
    confidence: 8, conceptDepth: 8,
  };

  test('asks follow-up when AI recommends and scores are low', () => {
    const result = shouldAskFollowUp({
      aiRecommends:  true,
      scores:        lowScores,
      followUpCount: 0,
    });
    expect(result).toBe(true);
  });

  test('skips follow-up when scores are high even if AI recommends', () => {
    const result = shouldAskFollowUp({
      aiRecommends:  true,
      scores:        highScores,
      followUpCount: 0,
    });
    expect(result).toBe(false);
  });

  test('skips follow-up when max follow-ups reached', () => {
    const result = shouldAskFollowUp({
      aiRecommends:  true,
      scores:        lowScores,
      followUpCount: 2,  // MAX_FOLLOWUPS = 2
    });
    expect(result).toBe(false);
  });

  test('skips follow-up when AI does not recommend', () => {
    const result = shouldAskFollowUp({
      aiRecommends:  false,
      scores:        lowScores,
      followUpCount: 0,
    });
    expect(result).toBe(false);
  });
});

// ─── Scoring Aggregator Tests ─────────────────────────────────

describe('computeScorecard', () => {
  const context: SessionContext = {
    sessionId: 'sess_test',
    userId:    'user_001',
    role:      'frontend',
    level:     'mid',
  };

  const mockQuestion = (id: string, type: 'concept' | 'problem' | 'behavioral' = 'concept'): InterviewQuestion => ({
    id, text: 'Test question', type, topic: 'react',
    difficulty: 'mid', expectedKeywords: [], followUpCount: 0, isFollowUp: false,
  });

  const mockEval = (questionId: string, scores: EvaluationScores): QuestionEvaluation => ({
    questionId, sessionId: 'sess_test', answerText: 'Test answer',
    scores, feedback: { strengths: [], weaknesses: [], improvements: [] },
    followUp: { shouldAsk: false, reason: '', missingKeywords: [] },
    detectedKeywords: [], evaluatedAt: new Date(),
  });

  test('computes correct overall score for perfect answers', () => {
    const perfectScores: EvaluationScores = {
      technical: 10, communication: 10, problemSolving: 10,
      confidence: 10, conceptDepth: 10,
    };
    const questions   = [mockQuestion('q1')];
    const evaluations = [mockEval('q1', perfectScores)];

    const scorecard = computeScorecard({ context, questions, evaluations, totalFollowUps: 0 });
    expect(scorecard.overallScore).toBe(10);
  });

  test('computes correct overall score for zero answers', () => {
    const zeroScores: EvaluationScores = {
      technical: 0, communication: 0, problemSolving: 0,
      confidence: 0, conceptDepth: 0,
    };
    const questions   = [mockQuestion('q1')];
    const evaluations = [mockEval('q1', zeroScores)];

    const scorecard = computeScorecard({ context, questions, evaluations, totalFollowUps: 0 });
    expect(scorecard.overallScore).toBe(0);
  });

  test('excludes follow-up questions from primary scoring', () => {
    const scores: EvaluationScores = {
      technical: 8, communication: 7, problemSolving: 7,
      confidence: 7, conceptDepth: 7,
    };
    const primaryQ: InterviewQuestion = {
      ...mockQuestion('q1'), isFollowUp: false
    };
    const followUpQ: InterviewQuestion = {
      ...mockQuestion('fu1'), isFollowUp: true, parentQuestionId: 'q1'
    };
    // Follow-up has terrible scores — should not drag down primary
    const lowScores: EvaluationScores = { technical: 1, communication: 1, problemSolving: 1, confidence: 1, conceptDepth: 1 };

    const scorecard = computeScorecard({
      context,
      questions:   [primaryQ, followUpQ],
      evaluations: [mockEval('q1', scores), mockEval('fu1', lowScores)],
      totalFollowUps: 1,
    });

    // Overall should reflect only primary question scores
    expect(scorecard.overallScore).toBeGreaterThan(5);
    expect(scorecard.totalFollowUps).toBe(1);
  });

  test('correctly reports total questions count', () => {
    const scores: EvaluationScores = { technical: 7, communication: 7, problemSolving: 7, confidence: 7, conceptDepth: 7 };
    const questions   = [mockQuestion('q1'), mockQuestion('q2'), mockQuestion('q3')];
    const evaluations = questions.map(q => mockEval(q.id, scores));

    const scorecard = computeScorecard({ context, questions, evaluations, totalFollowUps: 0 });
    expect(scorecard.totalQuestions).toBe(3);
  });
});

// ─── Score Classification Tests ───────────────────────────────

describe('classifyScore', () => {
  test('classifies 9.0 as excellent', () => expect(classifyScore(9.0)).toBe('excellent'));
  test('classifies 7.5 as strong',    () => expect(classifyScore(7.5)).toBe('strong'));
  test('classifies 6.0 as adequate',  () => expect(classifyScore(6.0)).toBe('adequate'));
  test('classifies 4.5 as developing', () => expect(classifyScore(4.5)).toBe('developing'));
  test('classifies 2.0 as insufficient', () => expect(classifyScore(2.0)).toBe('insufficient'));
});

// ─── Topic Picker Tests ───────────────────────────────────────

describe('pickTopic', () => {
  test('picks a topic for frontend role', () => {
    const topic = pickTopic('frontend', []);
    expect(typeof topic).toBe('string');
    expect(topic.length).toBeGreaterThan(0);
  });

  test('avoids recently used topics when possible', () => {
    const allFrontendTopics = ['react', 'javascript', 'css', 'performance', 'accessibility', 'browser APIs', 'typescript'];
    const used = allFrontendTopics.slice(0, 5);
    const topic = pickTopic('frontend', used);
    // With 2 remaining topics, result should not be in the used list
    expect(used).not.toContain(topic);
  });

  test('falls back gracefully when all topics used', () => {
    const allTopics = ['react', 'javascript', 'css', 'performance', 'accessibility', 'browser APIs', 'typescript'];
    const topic = pickTopic('frontend', allTopics);
    expect(typeof topic).toBe('string');
  });
});
