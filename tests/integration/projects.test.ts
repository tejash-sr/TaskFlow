import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Types } from 'mongoose';
import { errorHandler } from '@/middleware/error.middleware';
import { AppError } from '@/utils/AppError';
import healthRouter from '@/routes/health.routes';
import projectRouter from '@/routes/project.routes';
import taskRouter from '@/routes/task.routes';
import User from '@/models/User.model';
import Project from '@/models/Project.model';
import Task from '@/models/Task.model';
import { signAccessToken } from '@/utils/tokenUtils';

function createTestApp(userId: string, role = 'user') {
  const token = signAccessToken({ userId, role });
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use((_req, _res, next) => {
    if (!_req.headers.authorization) {
      _req.headers.authorization = `Bearer ${token}`;
    }
    next();
  });
  app.use('/api/health', healthRouter);
  app.use('/api/projects', projectRouter);
  app.use('/api/tasks', taskRouter);
  app.use((_req, _res, next) => {
    next(new AppError('Route not found', 404));
  });
  app.use(errorHandler);
  return app;
}

async function seedOwnerAndProject() {
  const owner = await User.create({
    email: `owner${Date.now()}@test.com`,
    password: 'password123',
    name: 'Project Owner',
  });

  const project = await Project.create({
    name: 'Test Project',
    description: 'Integration test',
    owner: owner._id,
    members: [owner._id],
  });

  return { owner, project };
}

describe('Project API — integration', () => {
  describe('GET /api/projects', () => {
    it('returns 200 with an array of projects', async () => {
      const { owner, project } = await seedOwnerAndProject();
      const app = createTestApp(owner._id.toString());

      const res = await request(app).get('/api/projects');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('includes taskCount on each project', async () => {
      const { owner, project } = await seedOwnerAndProject();
      const app = createTestApp(owner._id.toString());

      await Task.create({
        title: 'Task for count',
        description: 'desc',
        assignee: owner._id,
        project: project._id,
      });

      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      const found = res.body.data.find((p: { _id: string }) => p._id === project._id.toString());
      expect(found).toBeDefined();
      expect(found.taskCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/projects/:id', () => {
    it('returns 200 with the project details', async () => {
      const { owner, project } = await seedOwnerAndProject();
      const app = createTestApp(owner._id.toString());

      const res = await request(app).get(`/api/projects/${project._id}`);

      expect(res.status).toBe(200);
      expect(res.body.data._id).toBe(project._id.toString());
    });

    it('returns 404 for a non-existent project ID', async () => {
      const { owner } = await seedOwnerAndProject();
      const app = createTestApp(owner._id.toString());

      const res = await request(app).get(`/api/projects/${new Types.ObjectId()}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/projects', () => {
    it('creates a project and returns 201', async () => {
      const owner = await User.create({
        email: `creator${Date.now()}@test.com`,
        password: 'password123',
        name: 'Creator User',
      });
      const app = createTestApp(owner._id.toString());

      const res = await request(app)
        .post('/api/projects')
        .send({ name: 'New Integration Project', description: 'A project created via API' });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('name', 'New Integration Project');
    });

    it('returns 400 when name is missing', async () => {
      const owner = await User.create({
        email: `noname${Date.now()}@test.com`,
        password: 'password123',
        name: 'No Name User',
      });
      const app = createTestApp(owner._id.toString());

      const res = await request(app)
        .post('/api/projects')
        .send({ description: 'Missing name' });

      expect(res.status).toBe(422);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('deletes the project and returns 200 when owner requests it', async () => {
      const { owner, project } = await seedOwnerAndProject();
      const app = createTestApp(owner._id.toString());

      const res = await request(app).delete(`/api/projects/${project._id}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Project deleted successfully');
    });

    it('returns 403 when non-owner tries to delete', async () => {
      const { project } = await seedOwnerAndProject();
      const otherUser = await User.create({
        email: `other${Date.now()}@test.com`,
        password: 'password123',
        name: 'Other User',
      });
      const app = createTestApp(otherUser._id.toString());

      const res = await request(app).delete(`/api/projects/${project._id}`);

      expect(res.status).toBe(403);
    });

    it('returns 404 for a non-existent project', async () => {
      const owner = await User.create({
        email: `del404${Date.now()}@test.com`,
        password: 'password123',
        name: 'Del 404',
      });
      const app = createTestApp(owner._id.toString());

      const res = await request(app).delete(`/api/projects/${new Types.ObjectId()}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/projects/:id/members', () => {
    it('adds a new member and returns 200', async () => {
      const { owner, project } = await seedOwnerAndProject();
      const newMember = await User.create({
        email: `newmember${Date.now()}@test.com`,
        password: 'password123',
        name: 'New Member',
      });
      const app = createTestApp(owner._id.toString());

      const res = await request(app)
        .post(`/api/projects/${project._id}/members`)
        .send({ email: newMember.email });

      expect(res.status).toBe(200);
    });

    it('returns 404 when user email does not exist', async () => {
      const { owner, project } = await seedOwnerAndProject();
      const app = createTestApp(owner._id.toString());

      const res = await request(app)
        .post(`/api/projects/${project._id}/members`)
        .send({ email: 'nonexistent@test.com' });

      expect(res.status).toBe(404);
    });

    it('returns 400 when email is not provided', async () => {
      const { owner, project } = await seedOwnerAndProject();
      const app = createTestApp(owner._id.toString());

      const res = await request(app)
        .post(`/api/projects/${project._id}/members`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 409 when user is already a member', async () => {
      const { owner, project } = await seedOwnerAndProject();
      const app = createTestApp(owner._id.toString());

      // Owner is already a member
      const res = await request(app)
        .post(`/api/projects/${project._id}/members`)
        .send({ email: owner.email });

      expect(res.status).toBe(409);
    });
  });

  describe('DELETE /api/projects/:id/members/:memberId', () => {
    it('removes a member and returns 200 when owner requests it', async () => {
      const { owner, project } = await seedOwnerAndProject();
      const member = await User.create({
        email: `removeme${Date.now()}@test.com`,
        password: 'password123',
        name: 'Remove Me',
      });

      // Add member to project first
      project.members.push(member._id as Types.ObjectId);
      await project.save();

      const app = createTestApp(owner._id.toString());

      const res = await request(app).delete(
        `/api/projects/${project._id}/members/${member._id}`,
      );

      expect(res.status).toBe(200);
    });

    it('returns 403 when non-owner tries to remove member', async () => {
      const { project } = await seedOwnerAndProject();
      const otherUser = await User.create({
        email: `nonowner${Date.now()}@test.com`,
        password: 'password123',
        name: 'Non Owner',
      });
      const app = createTestApp(otherUser._id.toString());

      const res = await request(app).delete(
        `/api/projects/${project._id}/members/${otherUser._id}`,
      );

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/projects/:id/tasks', () => {
    it('returns paginated tasks for a project', async () => {
      const { owner, project } = await seedOwnerAndProject();
      const app = createTestApp(owner._id.toString());

      await Task.create({
        title: 'Project Task',
        description: 'test',
        assignee: owner._id,
        project: project._id,
      });

      const res = await request(app).get(`/api/projects/${project._id}/tasks`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns 404 for a non-existent project', async () => {
      const owner = await User.create({
        email: `tasklist404${Date.now()}@test.com`,
        password: 'password123',
        name: 'Task List 404',
      });
      const app = createTestApp(owner._id.toString());

      const res = await request(app).get(`/api/projects/${new Types.ObjectId()}/tasks`);

      expect(res.status).toBe(404);
    });
  });
});
