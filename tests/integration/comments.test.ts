import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Types } from 'mongoose';
import { errorHandler } from '@/middleware/error.middleware';
import { AppError } from '@/utils/AppError';
import healthRouter from '@/routes/health.routes';
import taskRouter from '@/routes/task.routes';
import projectRouter from '@/routes/project.routes';
import User from '@/models/User.model';
import Project from '@/models/Project.model';
import Task from '@/models/Task.model';
import Comment from '@/models/Comment.model';
import { signAccessToken } from '@/utils/tokenUtils';

function createTestApp(userId: string) {
  const token = signAccessToken({ userId, role: 'user' });
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
  app.use('/api/tasks', taskRouter);
  app.use('/api/projects', projectRouter);
  app.use((_req, _res, next) => {
    next(new AppError('Route not found', 404));
  });
  app.use(errorHandler);
  return app;
}

async function seedUserTaskAndProject() {
  const user = await User.create({
    email: `comment${Date.now()}@test.com`,
    password: 'password123',
    name: 'Comment User',
  });

  const project = await Project.create({
    name: 'Comment Test Project',
    description: 'For comment tests',
    owner: user._id,
    members: [user._id],
  });

  const task = await Task.create({
    title: 'Comment Target Task',
    description: 'desc',
    assignee: user._id,
    project: project._id,
  });

  return { user, project, task };
}

describe('Comment API — integration', () => {
  describe('POST /api/tasks/:id/comments', () => {
    it('creates a comment and returns 201', async () => {
      const { user, task } = await seedUserTaskAndProject();
      const app = createTestApp(user._id.toString());

      const res = await request(app)
        .post(`/api/tasks/${task._id}/comments`)
        .send({ content: 'This is a test comment' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('content', 'This is a test comment');
    });

    it('returns 404 when task does not exist', async () => {
      const { user } = await seedUserTaskAndProject();
      const app = createTestApp(user._id.toString());

      const res = await request(app)
        .post(`/api/tasks/${new Types.ObjectId()}/comments`)
        .send({ content: 'Comment on non-existent task' });

      expect(res.status).toBe(404);
    });

    it('returns 400 when content is missing', async () => {
      const { user, task } = await seedUserTaskAndProject();
      const app = createTestApp(user._id.toString());

      const res = await request(app)
        .post(`/api/tasks/${task._id}/comments`)
        .send({});

      expect(res.status).toBe(422);
    });
  });

  describe('GET /api/tasks/:id/comments', () => {
    it('returns 200 with list of comments', async () => {
      const { user, task } = await seedUserTaskAndProject();
      const app = createTestApp(user._id.toString());

      // Create a comment first
      await Comment.create({
        content: 'A comment to list',
        author: user._id,
        task: task._id,
      });

      const res = await request(app).get(`/api/tasks/${task._id}/comments`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('returns 404 when task does not exist', async () => {
      const { user } = await seedUserTaskAndProject();
      const app = createTestApp(user._id.toString());

      const res = await request(app).get(`/api/tasks/${new Types.ObjectId()}/comments`);

      expect(res.status).toBe(404);
    });

    it('returns empty array when task has no comments', async () => {
      const { user, task } = await seedUserTaskAndProject();
      const app = createTestApp(user._id.toString());

      const res = await request(app).get(`/api/tasks/${task._id}/comments`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('DELETE /api/tasks/:id/comments/:commentId', () => {
    it('deletes a comment and returns 200 when author requests it', async () => {
      const { user, task } = await seedUserTaskAndProject();
      const app = createTestApp(user._id.toString());

      const comment = await Comment.create({
        content: 'Delete me',
        author: user._id,
        task: task._id,
      });

      const res = await request(app).delete(
        `/api/tasks/${task._id}/comments/${comment._id}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Comment deleted successfully');
    });

    it('returns 403 when non-author tries to delete', async () => {
      const { task } = await seedUserTaskAndProject();

      const otherUser = await User.create({
        email: `other_comment${Date.now()}@test.com`,
        password: 'password123',
        name: 'Other Comment User',
      });

      const commentOwner = await User.create({
        email: `commentowner${Date.now()}@test.com`,
        password: 'password123',
        name: 'Comment Owner',
      });

      const comment = await Comment.create({
        content: 'Not yours to delete',
        author: commentOwner._id,
        task: task._id,
      });

      const app = createTestApp(otherUser._id.toString());

      const res = await request(app).delete(
        `/api/tasks/${task._id}/comments/${comment._id}`,
      );

      expect(res.status).toBe(403);
    });

    it('returns 404 when comment does not exist', async () => {
      const { user, task } = await seedUserTaskAndProject();
      const app = createTestApp(user._id.toString());

      const res = await request(app).delete(
        `/api/tasks/${task._id}/comments/${new Types.ObjectId()}`,
      );

      expect(res.status).toBe(404);
    });
  });
});
