import request from 'supertest';
import { createAppWithHandlers } from '@/app';
import User from '@/models/User.model';
import Project from '@/models/Project.model';
import Task from '@/models/Task.model';
import { signAccessToken } from '@/utils/tokenUtils';

const app = createAppWithHandlers();

async function seedAll() {
  const user = await User.create({
    name: 'Comment User',
    email: `comment-${Date.now()}@test.com`,
    password: 'password123',
  });
  const token = signAccessToken({ userId: user._id.toString(), role: 'user' });
  const project = await Project.create({
    name: 'Comment Project',
    description: 'desc',
    owner: user._id,
    members: [user._id],
  });
  const task = await Task.create({
    title: 'Comment Task',
    description: 'desc',
    assignee: user._id,
    project: project._id,
  });
  return { user, token, project, task };
}

describe('Comment API â€” integration', () => {
  describe('POST /api/tasks/:id/comments', () => {
    it('creates a comment and returns 201', async () => {
      const { token, task } = await seedAll();
      const res = await request(app)
        .post(`/api/tasks/${task._id}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ body: 'Great work on this task!' });
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('content', 'Great work on this task!');
    });

    it('returns 422 when body is missing', async () => {
      const { token, task } = await seedAll();
      const res = await request(app)
        .post(`/api/tasks/${task._id}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(422);
    });

    it('returns 401 when not authenticated', async () => {
      const { task } = await seedAll();
      const res = await request(app)
        .post(`/api/tasks/${task._id}/comments`)
        .send({ body: 'Unauthorized comment' });
      expect(res.status).toBe(401);
    });

    it('returns 404 for non-existent task', async () => {
      const { token } = await seedAll();
      const { Types } = await import('mongoose');
      const res = await request(app)
        .post(`/api/tasks/${new Types.ObjectId()}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ body: 'Comment on ghost task' });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/tasks/:id/comments', () => {
    it('returns an array of comments', async () => {
      const { token, task } = await seedAll();
      // Add a comment first
      await request(app)
        .post(`/api/tasks/${task._id}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ body: 'First comment' });

      const res = await request(app)
        .get(`/api/tasks/${task._id}/comments`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty array for task with no comments', async () => {
      const { token, task } = await seedAll();
      const res = await request(app)
        .get(`/api/tasks/${task._id}/comments`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('DELETE /api/tasks/:taskId/comments/:id', () => {
    it('deletes a comment when requester is author', async () => {
      const { token, task } = await seedAll();
      const createRes = await request(app)
        .post(`/api/tasks/${task._id}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ body: 'Delete me' });
      const commentId = createRes.body.data._id;

      const deleteRes = await request(app)
        .delete(`/api/tasks/${task._id}/comments/${commentId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(deleteRes.status).toBe(200);
    });

    it('returns 403 when non-author tries to delete', async () => {
      const { task, token: ownerToken } = await seedAll();
      // Create comment as original user
      const createRes = await request(app)
        .post(`/api/tasks/${task._id}/comments`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ body: 'Owned comment' });
      const commentId = createRes.body.data._id;

      // Try to delete as different user
      const otherUser = await User.create({
        name: 'Other User', email: `other-${Date.now()}@test.com`, password: 'password123',
      });
      const otherToken = signAccessToken({ userId: otherUser._id.toString(), role: 'user' });

      const deleteRes = await request(app)
        .delete(`/api/tasks/${task._id}/comments/${commentId}`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(deleteRes.status).toBe(403);
    });
  });

  describe('POST /api/tasks/:id/comments — field variants', () => {
    it('creates a comment using content field instead of body', async () => {
      const { token, task } = await seedAll();
      const res = await request(app)
        .post(`/api/tasks/${task._id}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Using content field' });
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('content');
    });
  });
});
