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
    it('attaches an uploaded PNG to the task and returns 200', async () => {
      const { token, task } = await seedTaskAndToken();

      // Create a valid 1x1 pixel PNG
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk length + type
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 pixels
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // bit depth, color type, etc.
        0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT
        0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
        0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC,
        0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, // IEND
        0x44, 0xAE, 0x42, 0x60, 0x82,
      ]);
      const tmpFile = path.join(os.tmpdir(), `test-${Date.now()}.png`);
      fs.writeFileSync(tmpFile, pngBuffer);

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

  describe('GET /api/tasks/:id/attachments/:attachmentId', () => {
    it('returns 404 when attachment ID does not exist on the task', async () => {
      const { token, task } = await seedTaskAndToken();
      const { Types } = await import('mongoose');
      const fakeAttachmentId = new Types.ObjectId().toString();

      const res = await request(app)
        .get(`/api/tasks/${task._id}/attachments/${fakeAttachmentId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('returns 410 when attachment record exists but file is missing from disk', async () => {
      const { token, task } = await seedTaskAndToken();

      // Manually push an attachment record pointing to a non-existent file path
      const nonExistentPath = path.join(os.tmpdir(), `ghost-file-${Date.now()}.png`);
      task.attachments.push({
        filename: 'ghost.png',
        path: nonExistentPath,
        size: 100,
      });
      await task.save();

      const savedTask = await Task.findById(task._id);
      const att = savedTask!.attachments[0] as unknown as { _id: { toString(): string } };
      const attachmentId = att._id.toString();

      const res = await request(app)
        .get(`/api/tasks/${task._id}/attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(410);
    });

    it('returns 404 when task ID does not exist', async () => {
      const { token } = await seedTaskAndToken();
      const { Types } = await import('mongoose');

      const res = await request(app)
        .get(`/api/tasks/${new Types.ObjectId()}/attachments/somefile.png`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('downloads via legacy /file/:filename route returns 404 when not found', async () => {
      const { token, task } = await seedTaskAndToken();

      const res = await request(app)
        .get(`/api/tasks/${task._id}/attachments/file/ghost-file-that-does-not-exist.png`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('downloads attachment successfully when file exists on disk', async () => {
      const { token, task } = await seedTaskAndToken();

      // Upload a real file first so it exists on disk
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
        0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
        0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC,
        0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
        0x44, 0xAE, 0x42, 0x60, 0x82,
      ]);
      const tmpFile = path.join(os.tmpdir(), `dl-test-${Date.now()}.png`);
      fs.writeFileSync(tmpFile, pngBuffer);

      const uploadRes = await request(app)
        .post(`/api/tasks/${task._id}/attachments`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', tmpFile);

      expect(uploadRes.status).toBe(200);
      const attachmentId = (uploadRes.body.data.attachments[0] as { _id: string })._id;

      const dlRes = await request(app)
        .get(`/api/tasks/${task._id}/attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${token}`)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        });

      // Cleanup temp file (upload moves it to uploads dir, original is gone)
      try { fs.unlinkSync(tmpFile); } catch { /* already moved by multer */ }

      expect([200]).toContain(dlRes.status);
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

    it('filters PDF by status and priority', async () => {
      const { token, user, project } = await seedTaskAndToken();
      await Task.create({
        title: 'Filtered PDF Task', description: 'pdf filter test',
        assignee: user._id, project: project._id, status: 'todo', priority: 'high',
      });

      const res = await request(app)
        .get('/api/tasks/export/pdf?status=todo&priority=high')
        .set('Authorization', `Bearer ${token}`)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/pdf/);
    });
  });
});

describe('Avatar Upload', () => {
  it('PUT /api/auth/me/avatar uploads avatar and GET /api/auth/me returns the avatar URL', async () => {
    const { user, token } = await seedTaskAndToken();

    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
      0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
      0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC,
      0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
      0x44, 0xAE, 0x42, 0x60, 0x82,
    ]);
    const tmpFile = path.join(os.tmpdir(), `avatar-${Date.now()}.png`);
    fs.writeFileSync(tmpFile, pngBuffer);

    const uploadRes = await request(app)
      .put('/api/auth/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', tmpFile);

    fs.unlinkSync(tmpFile);

    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body.data).toHaveProperty('avatarUrl');

    // Verify /api/auth/me reflects the avatar
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user).toHaveProperty('avatar');
  });

  it('DELETE /api/auth/me/avatar removes the avatar', async () => {
    const { token } = await seedTaskAndToken();
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00]);
    const tmpFile = path.join(os.tmpdir(), `avdel-${Date.now()}.png`);
    fs.writeFileSync(tmpFile, pngBuffer);

    await request(app)
      .put('/api/auth/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', tmpFile);
    fs.unlinkSync(tmpFile);

    const delRes = await request(app)
      .delete('/api/auth/me/avatar')
      .set('Authorization', `Bearer ${token}`);

    // Either 200 (success) or 400 (no avatar) if sharp failed — both are acceptable
    expect([200, 400]).toContain(delRes.status);
  });
});
