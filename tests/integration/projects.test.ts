import request from 'supertest';
import { createAppWithHandlers } from '@/app';
import User from '@/models/User.model';
import Project from '@/models/Project.model';
import Task from '@/models/Task.model';
import { signAccessToken } from '@/utils/tokenUtils';

const app = createAppWithHandlers();

async function seedOwnerAndProject() {
  const owner = await User.create({
    name: 'Project Owner',
    email: `owner-${Date.now()}@test.com`,
    password: 'password123',
  });
  const member = await User.create({
    name: 'Project Member',
    email: `member-${Date.now()}@test.com`,
    password: 'password123',
  });
  const ownerToken = signAccessToken({ userId: owner._id.toString(), role: 'user' });
  const memberToken = signAccessToken({ userId: member._id.toString(), role: 'user' });
  const project = await Project.create({
    name: 'Test Project',
    description: 'Integration test project',
    owner: owner._id,
    members: [owner._id],
  });
  return { owner, member, ownerToken, memberToken, project };
}

describe('Project API — integration', () => {
  describe('POST /api/projects', () => {
    it('creates a project and returns 201', async () => {
      const owner = await User.create({
        name: 'Creator', email: `proj-create-${Date.now()}@test.com`, password: 'password123',
      });
      const token = signAccessToken({ userId: owner._id.toString(), role: 'user' });

      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Project', description: 'A new project' });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('name', 'New Project');
    });

    it('returns 401 when not authenticated', async () => {
      const res = await request(app).post('/api/projects').send({ name: 'Test', description: 'test' });
      expect(res.status).toBe(401);
    });

    it('returns 422 when name is missing', async () => {
      const owner = await User.create({
        name: 'Val User', email: `val-${Date.now()}@test.com`, password: 'password123',
      });
      const token = signAccessToken({ userId: owner._id.toString(), role: 'user' });

      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'No name' });

      expect(res.status).toBe(422);
    });

    it('returns 422 when description is missing', async () => {
      const owner = await User.create({
        name: 'NDesc User', email: `ndesc-${Date.now()}@test.com`, password: 'password123',
      });
      const token = signAccessToken({ userId: owner._id.toString(), role: 'user' });

      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Only Name' });

      expect(res.status).toBe(422);
    });
  });

  describe('GET /api/projects', () => {
    it('returns a list of projects', async () => {
      const { ownerToken } = await seedOwnerAndProject();
      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('includes taskCount in project data', async () => {
      const { ownerToken, project, owner } = await seedOwnerAndProject();
      await Task.create({
        title: 'Count Me', description: 'desc', assignee: owner._id, project: project._id,
      });
      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      const found = res.body.data.find((p: { _id: string }) => p._id === project._id.toString());
      expect(found?.taskCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/projects/:id', () => {
    it('returns a project by ID', async () => {
      const { ownerToken, project } = await seedOwnerAndProject();
      const res = await request(app)
        .get(`/api/projects/${project._id}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data._id).toBe(project._id.toString());
    });

    it('returns 404 for non-existent project ID', async () => {
      const { ownerToken } = await seedOwnerAndProject();
      const { Types } = await import('mongoose');
      const res = await request(app)
        .get(`/api/projects/${new Types.ObjectId()}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/projects/:id/members', () => {
    it('adds a member when requester is owner', async () => {
      const { ownerToken, project, member } = await seedOwnerAndProject();
      const res = await request(app)
        .post(`/api/projects/${project._id}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: member.email });
      expect(res.status).toBe(200);
    });

    it('returns 403 when non-owner tries to add member', async () => {
      const { memberToken, project } = await seedOwnerAndProject();
      const stranger = await User.create({
        name: 'Stranger', email: `stranger-${Date.now()}@test.com`, password: 'password123',
      });
      const res = await request(app)
        .post(`/api/projects/${project._id}/members`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ email: stranger.email });
      expect(res.status).toBe(403);
    });

    it('returns 404 when user email not found', async () => {
      const { ownerToken, project } = await seedOwnerAndProject();
      const res = await request(app)
        .post(`/api/projects/${project._id}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: 'nonexistent@nowhere.com' });
      expect(res.status).toBe(404);
    });

    it('returns 400 when email is missing from request body', async () => {
      const { ownerToken, project } = await seedOwnerAndProject();
      const res = await request(app)
        .post(`/api/projects/${project._id}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('deletes project when requester is owner', async () => {
      const { ownerToken, project } = await seedOwnerAndProject();
      const res = await request(app)
        .delete(`/api/projects/${project._id}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
    });

    it('returns 403 when non-owner tries to delete', async () => {
      const { memberToken, project } = await seedOwnerAndProject();
      const res = await request(app)
        .delete(`/api/projects/${project._id}`)
        .set('Authorization', `Bearer ${memberToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/projects/:id/report', () => {
    it('returns application/pdf content-type', async () => {
      const { ownerToken, project } = await seedOwnerAndProject();
      const res = await request(app)
        .get(`/api/projects/${project._id}/report`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .buffer(true)
        .parse((res, cb) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => cb(null, Buffer.concat(chunks)));
        });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/pdf/);
    });
  });

  describe('GET /api/projects/:id/export', () => {
    it('returns CSV export of project tasks', async () => {
      const { ownerToken, project, owner } = await seedOwnerAndProject();
      await Task.create({
        title: 'Export Task', description: 'desc',
        assignee: owner._id, project: project._id,
      });

      const res = await request(app)
        .get(`/api/projects/${project._id}/export`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
    });

    it('returns 404 for non-existent project ID on export', async () => {
      const { ownerToken } = await seedOwnerAndProject();
      const { Types } = await import('mongoose');
      const res = await request(app)
        .get(`/api/projects/${new Types.ObjectId()}/export`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/projects/:id/tasks — with page and limit', () => {
    it('uses provided page and limit query params', async () => {
      const { ownerToken, project, owner } = await seedOwnerAndProject();

      await Task.create([
        { title: 'Project Paged Task A', description: 'desc', assignee: owner._id, project: project._id },
        { title: 'Project Paged Task B', description: 'desc', assignee: owner._id, project: project._id },
      ]);

      const res = await request(app)
        .get(`/api/projects/${project._id}/tasks?page=1&limit=5`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns 404 when project does not exist', async () => {
      const { ownerToken } = await seedOwnerAndProject();
      const { Types } = await import('mongoose');
      const res = await request(app)
        .get(`/api/projects/${new Types.ObjectId()}/tasks`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(404);
    });
  });
});
