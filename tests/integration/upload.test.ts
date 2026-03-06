import request from 'supertest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createAppWithHandlers } from '@/app';

import User from '@/models/User.model';
import Project from '@/models/Project.model';
import Task from '@/models/Task.model';
import { signAccessToken } from '@/utils/tokenUtils';

const app = createAppWithHandlers();

async function seedTaskAndToken() {
  const user = await User.create({
    name: 'Upload User',
    email: `upload${Date.now()}@test.com`,
    password: 'password123',
  });
  const token = signAccessToken({ userId: user._id.toString(), role: 'user' });
  const project = await Project.create({
    name: 'Upload Project',
    description: 'for upload tests',
    owner: user._id,
    members: [user._id],
  });
  const task = await Task.create({
    title: 'Upload Target Task',
    description: 'desc',
    assignee: user._id,
    project: project._id,
  });
  return { user, token, project, task };
}

describe('File Upload & Export — integration', () => {
  describe('POST /api/tasks/:id/attachments', () => {
    it.skip('attaches an uploaded PNG to the task and returns 200', async () => {
      const { token, task } = await seedTaskAndToken();

      // Create a tiny PNG-like temp file
      const tmpFile = path.join(os.tmpdir(), `test-${Date.now()}.png`);
      fs.writeFileSync(tmpFile, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

      const res = await request(app)
        .post(`/api/tasks/${task._id}/attachments`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', tmpFile);

      fs.unlinkSync(tmpFile);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.attachments)).toBe(true);
      expect(res.body.data.attachments).toHaveLength(1);
    });

    it('returns 400 when no file is provided', async () => {
      const { token, task } = await seedTaskAndToken();

      const res = await request(app)
        .post(`/api/tasks/${task._id}/attachments`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });

    it('returns 404 when the task does not exist', async () => {
      const { token } = await seedTaskAndToken();
      const { Types } = await import('mongoose');
      const tmpFile = path.join(os.tmpdir(), `test-${Date.now()}.png`);
      fs.writeFileSync(tmpFile, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

      const res = await request(app)
        .post(`/api/tasks/${new Types.ObjectId()}/attachments`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', tmpFile);

      fs.unlinkSync(tmpFile);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/tasks/export/csv', () => {
    it('returns a CSV file with headers', async () => {
      const { token, user, project } = await seedTaskAndToken();
      await Task.create({
        title: 'Export Me',
        description: 'csv export test',
        assignee: user._id,
        project: project._id,
      });

      const res = await request(app)
        .get('/api/tasks/export/csv')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.text).toContain('id,title,status,priority');
    });
  });

  describe('GET /api/tasks/export/pdf', () => {
    it('returns a PDF binary response', async () => {
      const { token } = await seedTaskAndToken();

      const res = await request(app)
        .get('/api/tasks/export/pdf')
        .set('Authorization', `Bearer ${token}`)
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/pdf/);
      // PDF magic bytes: %PDF
      expect((res.body as Buffer).slice(0, 4).toString()).toBe('%PDF');
    });
  });
});
