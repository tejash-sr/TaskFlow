import request from 'supertest';
import { createAppWithHandlers } from '@/app';
import User from '@/models/User.model';
import Project from '@/models/Project.model';
import Task from '@/models/Task.model';
import { signAccessToken } from '@/utils/tokenUtils';

const app = createAppWithHandlers();

describe('Task routes - extended coverage', () => {
  let testUser: any;
  let testProject: any;
  let testTask: any;
  let token: string;

  beforeEach(async () => {
    testUser = await User.create({
      name: 'Route Test User',
      email: `route${Date.now()}@test.com`,
      password: 'password123',
    });

    token = signAccessToken({ userId: testUser._id.toString(), role: 'user' });

    testProject = await Project.create({
      name: 'Route Test Project',
      description: 'for route tests',
      owner: testUser._id,
      members: [testUser._id],
    });

    testTask = await Task.create({
      title: 'Route Test Task',
      description: 'Test task',
      assignee: testUser._id,
      project: testProject._id,
    });
  });

  describe('GET /api/tasks - pagination and filters', () => {
    it('returns tasks with default pagination', async () => {
      const res = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.tasks)).toBe(true);
    });

    it('filters tasks by status', async () => {
      const res = await request(app)
        .get('/api/tasks?status=todo')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.tasks)).toBe(true);
    });

    it('filters tasks by priority', async () => {
      const res = await request(app)
        .get('/api/tasks?priority=medium')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.tasks)).toBe(true);
    });

    it('searches tasks by title', async () => {
      const res = await request(app)
        .get('/api/tasks?search=Route')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('supports cursor-based pagination', async () => {
      const res = await request(app)
        .get('/api/tasks?cursor=id&limit=5')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/tasks/:id', () => {
    it('returns task details', async () => {
      const res = await request(app)
        .get(`/api/tasks/${testTask._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.task._id).toBe(testTask._id.toString());
    });

    it('returns 404 for non-existent task', async () => {
      const fakeId = '507f1f77bcf86cd799439999';
      const res = await request(app)
        .get(`/api/tasks/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/tasks/:id - PDF-05 authorization', () => {
    it('allows task assignee to update', async () => {
      const res = await request(app)
        .put(`/api/tasks/${testTask._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Updated Title',
          status: 'in_progress',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.task.title).toBe('Updated Title');
    });

    it('allows admin to update any task', async () => {
      const admin = await User.create({
        name: 'Admin User',
        email: `admin${Date.now()}@test.com`,
        password: 'password123',
        role: 'admin',
      });

      const adminToken = signAccessToken({
        userId: admin._id.toString(),
        role: 'admin',
      });

      const res = await request(app)
        .put(`/api/tasks/${testTask._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Admin Updated',
        });

      expect(res.status).toBe(200);
    });

    it('rejects update from non-assignee', async () => {
      const other = await User.create({
        name: 'Other User',
        email: `other${Date.now()}@test.com`,
        password: 'password123',
      });

      const otherToken = signAccessToken({
        userId: other._id.toString(),
        role: 'user',
      });

      const res = await request(app)
        .put(`/api/tasks/${testTask._id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          title: 'Unauthorized Update',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/tasks/:id - PDF-05 authorization', () => {
    it('allows task assignee to delete', async () => {
      const res = await request(app)
        .delete(`/api/tasks/${testTask._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('rejects delete from non-assignee', async () => {
      const other = await User.create({
        name: 'Other User',
        email: `other${Date.now()}@test.com`,
        password: 'password123',
      });

      const otherToken = signAccessToken({
        userId: other._id.toString(),
        role: 'user',
      });

      const res = await request(app)
        .delete(`/api/tasks/${testTask._id}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/tasks/:id/comments', () => {
    it('creates comment on task', async () => {
      const res = await request(app)
        .post(`/api/tasks/${testTask._id}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          content: 'This is a test comment',
        });

      expect([200, 201]).toContain(res.status);
      if (res.body.data.comment) {
        expect(res.body.data.comment.content).toBe('This is a test comment');
      }
    });

    it('validates comment is not empty', async () => {
      const res = await request(app)
        .post(`/api/tasks/${testTask._id}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          content: '',
        });

      expect([400, 422]).toContain(res.status);
    });
  });
});
