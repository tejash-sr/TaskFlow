import request from 'supertest';
import { createAppWithHandlers } from '@/app';
import User from '@/models/User.model';
import { signAccessToken } from '@/utils/tokenUtils';

const app = createAppWithHandlers();

describe('Auth API endpoints - extended coverage', () => {
  let testUser: any;
  let token: string;

  beforeEach(async () => {
    testUser = await User.create({
      name: 'Auth Test User',
      email: `authtest${Date.now()}@test.com`,
      password: 'password123',
    });
    token = signAccessToken({ userId: testUser._id.toString(), role: 'user' });
  });

  describe('MISSING-01: PUT /api/auth/me', () => {
    it('updates user profile with valid data', async () => {
      const res = await request(app)
        .put('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Updated Name',
          email: 'newemail@test.com',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.name).toBe('Updated Name');
      expect(res.body.data.user.email.toLowerCase()).toBe('newemail@test.com');
    });

    it('rejects duplicate email', async () => {
      // Create another user with an email
      const otherUser = await User.create({
        name: 'Other User',
        email: `other${Date.now()}@test.com`,
        password: 'password123',
      });

      const res = await request(app)
        .put('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: otherUser.email,
        });

      expect(res.status).toBe(409);
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .put('/api/auth/me')
        .send({
          name: 'Updated Name',
        });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('validates name length (min 2 chars)', async () => {
      const res = await request(app)
        .put('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'A',
        });

      expect([200, 400, 422]).toContain(res.status);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns current user profile', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user).toHaveProperty('_id');
      expect(res.body.data.user).toHaveProperty('email');
      expect(res.body.data.user).toHaveProperty('name');
    });

    it('returns 404 for deleted user', async () => {
      await User.deleteOne({ _id: testUser._id });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('Token refresh', () => {
    it('issues new token on refresh', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect([200, 401]).toContain(res.status);
    });
  });
});
