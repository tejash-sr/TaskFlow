import request from 'supertest';
import { createAppWithHandlers } from '@/app';
import User from '@/models/User.model';

const app = createAppWithHandlers();

async function createUser(email: string, password: string, name = 'Test User') {
  return User.create({ email, password, name });
}

describe('Auth API — integration', () => {
  describe('POST /api/auth/signup', () => {
    it('creates a user and returns 201 with tokens', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ name: 'Alice', email: 'alice@test.com', password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(res.body.data.user).toHaveProperty('email', 'alice@test.com');
    });

    it('returns 409 when email is already registered', async () => {
      await createUser('bob@test.com', 'password123', 'Bob');

      const res = await request(app)
        .post('/api/auth/signup')
        .send({ name: 'Bob Again', email: 'bob@test.com', password: 'password123' });

      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns 200 with tokens for valid credentials', async () => {
      await createUser('carol@test.com', 'password123', 'Carol');

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'carol@test.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('accessToken');
    });

    it('returns 401 for wrong password', async () => {
      await createUser('dave@test.com', 'password123', 'Dave');

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'dave@test.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
    });

    it('returns 401 for unknown email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'ghost@test.com', password: 'password123' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('returns new tokens for a valid refresh token', async () => {
      const signup = await request(app)
        .post('/api/auth/signup')
        .send({ name: 'Eve', email: 'eve@test.com', password: 'password123' });

      const { refreshToken } = signup.body.data as { refreshToken: string };

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('accessToken');
    });

    it('returns 401 for an invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'bad.token.here' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns current user info with valid token', async () => {
      const signup = await request(app)
        .post('/api/auth/signup')
        .send({ name: 'Frank', email: 'frank@test.com', password: 'password123' });

      const { accessToken } = signup.body.data as { accessToken: string };

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      // getMe now returns full user object under data.user
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data.user).toHaveProperty('email', 'frank@test.com');
    });

    it('returns 401 with no token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('returns 200 even for an unknown email (no email harvesting)', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nobody@test.com' });

      expect(res.status).toBe(200);
    });

    it('returns a reset token in non-production mode', async () => {
      await createUser('grace@test.com', 'password123', 'Grace');

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'grace@test.com' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('resetToken');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('resets the password successfully with a valid token', async () => {
      await createUser('henry@test.com', 'oldpassword', 'Henry');

      const forgotRes = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'henry@test.com' });

      const { resetToken } = forgotRes.body as { resetToken: string };

      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: resetToken, password: 'newpassword123' });

      expect(resetRes.status).toBe(200);

      // Confirm new password works
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'henry@test.com', password: 'newpassword123' });

      expect(loginRes.status).toBe(200);
    });

    it('returns 400 for an invalid reset token', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'bad-token', password: 'newpassword' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('returns 200 with valid token', async () => {
      const signup = await request(app)
        .post('/api/auth/signup')
        .send({ name: 'Ivan', email: 'ivan@test.com', password: 'password123' });

      const { accessToken } = signup.body.data as { accessToken: string };

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
    });

    it('returns 401 when no token is provided', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(401);
    });
  });
});
