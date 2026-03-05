import request from 'supertest';
import { createAppWithHandlers } from '@/app';
import User from '@/models/User.model';
import Project from '@/models/Project.model';
import { signAccessToken } from '@/utils/tokenUtils';

const app = createAppWithHandlers();

async function seedAuth() {
  const user = await User.create({
    name: 'Validator User',
    email: `v${Date.now()}@test.com`,
    password: 'password123',
  });
  const token = signAccessToken({ userId: user._id.toString(), role: 'user' });
  const project = await Project.create({
    name: 'Val Project',
    description: 'desc',
    owner: user._id,
    members: [user._id],
  });
  return { user, token, project };
}

describe('Validation — integration', () => {
  describe('Auth routes', () => {
    it('POST /api/auth/signup returns 422 when name is missing', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'a@test.com', password: 'password123' });
      expect(res.status).toBe(422);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'name' })]),
      );
    });

    it('POST /api/auth/signup returns 422 for invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ name: 'Test', email: 'not-an-email', password: 'password123' });
      expect(res.status).toBe(422);
    });

    it('POST /api/auth/signup returns 422 when password is too short', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ name: 'Test', email: 'b@test.com', password: 'short' });
      expect(res.status).toBe(422);
    });

    it('POST /api/auth/login returns 422 when email is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'password123' });
      expect(res.status).toBe(422);
    });
  });

  describe('Task routes', () => {
    it('POST /api/tasks returns 422 when title is missing', async () => {
      const { token, project, user } = await seedAuth();
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'desc', project: project._id, assignee: user._id });
      expect(res.status).toBe(422);
    });

    it('POST /api/tasks returns 422 for an invalid project MongoId', async () => {
      const { token, user } = await seedAuth();
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Task', description: 'desc', project: 'not-an-id', assignee: user._id });
      expect(res.status).toBe(422);
    });

    it('GET /api/tasks/:id returns 422 for an invalid Mongo ID', async () => {
      const { token } = await seedAuth();
      const res = await request(app)
        .get('/api/tasks/not-an-id')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(422);
    });

    it('GET /api/tasks returns 422 for a negative page value', async () => {
      const { token } = await seedAuth();
      const res = await request(app)
        .get('/api/tasks?page=-1')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(422);
    });
  });

  describe('Project routes', () => {
    it('POST /api/projects returns 422 when name is missing', async () => {
      const { token } = await seedAuth();
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'desc' });
      expect(res.status).toBe(422);
    });
  });
});
