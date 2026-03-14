import { computeScorecard } from '../services/scoringService';
import { Evaluation } from '../models/Evaluation';
import { InterviewSession } from '../models/InterviewSession';
import { Scorecard } from '../models/Scorecard';
import mongoose from 'mongoose';

jest.mock('../sockets', () => ({
  notifyScorecardReady: jest.fn(),
}));

jest.mock('../queues', () => ({
  computeRecommendationsQueue: { add: jest.fn().mockResolvedValue({}) },
}));

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/nxtstep_test');
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

describe('Scoring Service', () => {
  it('computes weighted scorecard from evaluations', async () => {
    const userId = new mongoose.Types.ObjectId();
    const session = await InterviewSession.create({
      userId,
      role: 'Frontend Developer',
      difficulty: 'mid',
      status: 'completed',
      questions: [
        { id: 'q1', text: 'Explain React hooks', type: 'concept', topic: 'react',
          difficulty: 'mid', expectedKeywords: ['useState'], followUpCount: 0 },
        { id: 'q2', text: 'Solve a problem', type: 'problem', topic: 'algorithms',
          difficulty: 'mid', expectedKeywords: ['loop'], followUpCount: 0 },
      ],
    });

    await Evaluation.create([
      {
        sessionId: session._id,
        questionId: 'q1',
        answerText: 'useState is a hook...',
        scores: { technical: 8, communication: 7, problemSolving: 6, confidence: 7, conceptDepth: 7 },
        feedback: { strengths: ['Clear'], weaknesses: [], improvements: [] },
        followUp: { shouldAsk: false, reason: '' },
      },
      {
        sessionId: session._id,
        questionId: 'q2',
        answerText: 'I would use a loop...',
        scores: { technical: 6, communication: 8, problemSolving: 9, confidence: 8, conceptDepth: 6 },
        feedback: { strengths: ['Good logic'], weaknesses: [], improvements: [] },
        followUp: { shouldAsk: false, reason: '' },
      },
    ]);

    const scorecard = await computeScorecard(session._id.toString(), userId.toString());

    expect(scorecard.overall).toBeGreaterThan(0);
    expect(scorecard.overall).toBeLessThanOrEqual(10);
    expect(scorecard.technical).toBeGreaterThan(0);
    expect(scorecard.questionsEvaluated).toBe(2);

    // Problem-type questions have 1.5 weight, concept = 1.0
    // Technical: (1.0*8 + 1.5*6) / (1.0+1.5) = (8+9)/2.5 = 6.8
    expect(scorecard.technical).toBeCloseTo(6.8, 1);

    // Clean up
    await Scorecard.deleteMany({ sessionId: session._id });
    await Evaluation.deleteMany({ sessionId: session._id });
    await InterviewSession.findByIdAndDelete(session._id);
  });
});