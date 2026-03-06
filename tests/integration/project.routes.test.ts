import request from 'supertest';
import { createAppWithHandlers } from '@/app';
import User from '@/models/User.model';
import Project from '@/models/Project.model';
import { signAccessToken } from '@/utils/tokenUtils';

const app = createAppWithHandlers();

describe('Project routes - extended coverage', () => {
  let testUser: any;
  let token: string;
  let testProject: any;

  beforeEach(async () => {
    testUser = await User.create({
      name: 'Project Route User',
      email: `projroute${Date.now()}@test.com`,
      password: 'password123',
    });

    token = signAccessToken({
      userId: testUser._id.toString(),
      role: 'user',
    });

    testProject = await Project.create({
      name: 'Test Route Project',
      description: 'for route tests',
      owner: testUser._id,
      members: [testUser._id],
    });
  });

  describe('GET /api/projects', () => {
    it('returns list of projects', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.projects)).toBe(true);
    });
  });

  describe('GET /api/projects/:id', () => {
    it('returns project details', async () => {
      const res = await request(app)
        .get(`/api/projects/${testProject._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.project).toHaveProperty('_id');
      expect(res.body.data.project).toHaveProperty('name');
    });

    it('returns 404 for non-existent project', async () => {
      const res = await request(app)
        .get('/api/projects/507f1f77bcf86cd799439999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/projects/:id/members - BUG-01', () => {
    let newMember: any;

    beforeEach(async () => {
      newMember = await User.create({
        name: 'New Member',
        email: `newmember${Date.now()}@test.com`,
        password: 'password123',
      });
    });

    it('allows owner to add members', async () => {
      const res = await request(app)
        .post(`/api/projects/${testProject._id}/members`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: newMember.email,
        });

      expect(res.status).toBe(200);
      const project = res.body.data.project || res.body.data;
      if (project.members) {
        expect(project.members.some((m: any) => m._id === newMember._id.toString())).toBe(true);
      }
    });

    it('prevents non-owner from adding members', async () => {
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
        .post(`/api/projects/${testProject._id}/members`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          email: newMember.email,
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('owner');
    });

    it('errors on non-existent user email', async () => {
      const res = await request(app)
        .post(`/api/projects/${testProject._id}/members`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'nonexistent@example.com',
        });

      expect([404, 400]).toContain(res.status);
    });
  });

  describe('POST /api/projects/:id/members/:memberId/remove - BUG-01', () => {
    let member: any;

    beforeEach(async () => {
      member = await User.create({
        name: 'Remove Test Member',
        email: `remove${Date.now()}@test.com`,
        password: 'password123',
      });
      // Add member to project
      testProject.members.push(member._id);
      await testProject.save();
    });

    it('allows owner to remove members', async () => {
      const res = await request(app)
        .post(`/api/projects/${testProject._id}/members/${member._id}/remove`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('prevents non-owner from removing members', async () => {
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
        .post(`/api/projects/${testProject._id}/members/${member._id}/remove`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/projects/:id', () => {
    it('allows owner to update project', async () => {
      const res = await request(app)
        .put(`/api/projects/${testProject._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Updated Project Name',
          description: 'Updated description',
        });

      expect(res.status).toBe(200);
      if (res.body.data) {
        expect(res.body.data.name || res.body.data.project?.name).toBe('Updated Project Name');
      }
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('allows owner to delete project', async () => {
      const res = await request(app)
        .delete(`/api/projects/${testProject._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('errors on non-existent project', async () => {
      const res = await request(app)
        .delete('/api/projects/507f1f77bcf86cd799439999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
