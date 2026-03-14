import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../app';

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/nxtstep_test');
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

describe('Auth API', () => {
  const testUser = {
    name: 'Test User',
    email: `test_${Date.now()}@nxtstep.test`,
    password: 'Password123!',
  };

  let authToken = '';

  it('POST /api/auth/signup - creates a new user', async () => {
    const res = await request(app).post('/api/auth/signup').send(testUser);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe(testUser.email);
    expect(res.body.data.user.passwordHash).toBeUndefined();
    authToken = res.body.data.token;
  });

  it('POST /api/auth/signup - rejects duplicate email', async () => {
    const res = await request(app).post('/api/auth/signup').send(testUser);
    expect(res.status).toBe(409);
  });

  it('POST /api/auth/signup - validates required fields', async () => {
    const res = await request(app).post('/api/auth/signup').send({ email: 'bad' });
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/login - logs in successfully', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
  });

  it('POST /api/auth/login - rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me - returns profile with valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(testUser.email);
  });

  it('GET /api/auth/me - rejects without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/forgot-password - always returns success', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: testUser.email });
    expect(res.status).toBe(200);
  });
});