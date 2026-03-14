import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../app';
import * as authService from '../services/authService';

jest.mock('../queues', () => ({
  generateQuestionQueue: { add: jest.fn().mockResolvedValue({}) },
  evaluateAnswerQueue: { add: jest.fn().mockResolvedValue({}) },
  computeScorecardQueue: { add: jest.fn().mockResolvedValue({}) },
  computeRecommendationsQueue: { add: jest.fn().mockResolvedValue({}) },
}));

jest.mock('../sockets', () => ({
  notifyInterviewTerminated: jest.fn(),
  notifyQuestionReady: jest.fn(),
}));

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/nxtstep_test');
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

describe('Interview API', () => {
  let authToken = '';
  let sessionId = '';

  beforeAll(async () => {
    const result = await authService.signup({
      name: 'Interview Test User',
      email: `interview_${Date.now()}@nxtstep.test`,
      password: 'Password123!',
    });
    authToken = result.token;
  });

  it('POST /api/interview/start - starts an interview session', async () => {
    const res = await request(app)
      .post('/api/interview/start')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ role: 'Frontend Developer', difficulty: 'mid' });

    expect(res.status).toBe(201);
    expect(res.body.data.session).toBeDefined();
    expect(res.body.data.ephemeralToken).toBeDefined();
    expect(res.body.data.session.status).toBe('in_progress');
    sessionId = res.body.data.session._id;
  });

  it('GET /api/interview/:sessionId - fetches session', async () => {
    const res = await request(app)
      .get(`/api/interview/${sessionId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(sessionId);
  });

  it('POST /api/interview/:sessionId/event - records tab switch', async () => {
    const res = await request(app)
      .post(`/api/interview/${sessionId}/event`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ type: 'tab_switch', payload: {} });

    expect(res.status).toBe(200);
    expect(['logged', 'warning', 'terminated']).toContain(res.body.data.action);
  });

  it('POST /api/interview/:sessionId/end - ends interview', async () => {
    const res = await request(app)
      .post(`/api/interview/${sessionId}/end`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
  });

  it('GET /api/interview - returns user sessions list', async () => {
    const res = await request(app)
      .get('/api/interview')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});