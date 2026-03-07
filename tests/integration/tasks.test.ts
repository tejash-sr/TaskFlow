import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from '@/middleware/error.middleware';
import { AppError } from '@/utils/AppError';
import healthRouter from '@/routes/health.routes';
import taskRouter from '@/routes/task.routes';
import projectRouter from '@/routes/project.routes';
import User from '@/models/User.model';
import Project from '@/models/Project.model';
import Task from '@/models/Task.model';
import { signAccessToken } from '@/utils/tokenUtils';

function createTestApp(userId: string) {
  const token = signAccessToken({ userId, role: 'user' });
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  // Pre-inject the Authorization header so isAuth middleware (inside routers) succeeds
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

async function seedUserAndProject() {
  const user = await new User({
    email: `u${Date.now()}@test.com`,
    password: 'password123',
    name: 'Test User',
  }).save();

  const project = await new Project({
    name: 'Test Project',
    description: 'Integration test project',
    owner: user._id,
    members: [user._id],
  }).save();

  return { user, project };
}

describe('Task API — integration', () => {
  describe('POST /api/tasks', () => {
    it('returns 201 and the created task for valid data', async () => {
      const { user, project } = await seedUserAndProject();
      const app = createTestApp(user._id.toString());

      const res = await request(app)
        .post('/api/tasks')
        .send({
          title: 'Integration Test Task',
          description: 'Created via integration test',
          assignee: user._id.toString(),
          project: project._id.toString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('title', 'Integration Test Task');
    });
  });

  describe('GET /api/tasks', () => {
    it('returns a paginated list with pagination metadata', async () => {
      const { user, project } = await seedUserAndProject();
      const app = createTestApp(user._id.toString());

      await Task.create({
        title: 'Paginated Task One',
        description: 'desc',
        assignee: user._id,
        project: project._id,
      });

      const res = await request(app).get('/api/tasks');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('limit');
      expect(res.body).toHaveProperty('totalPages');
      expect(res.body).toHaveProperty('hasMore');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('filters tasks by status', async () => {
      const { user, project } = await seedUserAndProject();
      const app = createTestApp(user._id.toString());

      await Task.create([
        { title: 'Todo Task One', description: 'desc', assignee: user._id, project: project._id, status: 'todo' },
        { title: 'Done Task One', description: 'desc', assignee: user._id, project: project._id, status: 'done' },
      ]);

      const res = await request(app).get('/api/tasks?status=todo');

      expect(res.status).toBe(200);
      expect(res.body.data.every((t: { status: string }) => t.status === 'todo')).toBe(true);
    });
  });

  describe('GET /api/tasks/:id', () => {
    it('returns the task with populated references', async () => {
      const { user, project } = await seedUserAndProject();
      const app = createTestApp(user._id.toString());

      const task = await new Task({
        title: 'Fetch Me Task',
        description: 'desc',
        assignee: user._id,
        project: project._id,
      }).save();

      const res = await request(app).get(`/api/tasks/${task._id}`);

      expect(res.status).toBe(200);
      expect(res.body.data._id).toBe(task._id.toString());
      expect(res.body.data.assignee).toHaveProperty('name');
    });

    it('returns 404 for a non-existent task ID', async () => {
      const { user } = await seedUserAndProject();
      const app = createTestApp(user._id.toString());
      const { Types } = await import('mongoose');
      const res = await request(app).get(`/api/tasks/${new Types.ObjectId()}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/tasks/:id', () => {
    it('updates only the provided fields', async () => {
      const { user, project } = await seedUserAndProject();
      const app = createTestApp(user._id.toString());

      const task = await new Task({
        title: 'Original Title',
        description: 'Original description',
        assignee: user._id,
        project: project._id,
      }).save();

      const res = await request(app)
        .put(`/api/tasks/${task._id}`)
        .send({ title: 'Updated Title' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Updated Title');
      expect(res.body.data.description).toBe('Original description');
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('soft-deletes the task and keeps it in the database', async () => {
      const { user, project } = await seedUserAndProject();
      const app = createTestApp(user._id.toString());

      const task = await new Task({
        title: 'Delete Me Task',
        description: 'desc',
        assignee: user._id,
        project: project._id,
      }).save();

      const res = await request(app).delete(`/api/tasks/${task._id}`);

      expect(res.status).toBe(200);

      const inDb = await Task.findById(task._id);
      expect(inDb).not.toBeNull();
      expect(inDb!.deletedAt).toBeDefined();
    });
  });

  describe('GET /api/projects/:id/tasks', () => {
    it('returns only tasks belonging to the specified project', async () => {
      const { user, project } = await seedUserAndProject();
      const { project: otherProject } = await seedUserAndProject();
      const app = createTestApp(user._id.toString());

      await Task.create([
        { title: 'Project Task One', description: 'desc', assignee: user._id, project: project._id },
        { title: 'Other Project Task', description: 'desc', assignee: user._id, project: otherProject._id },
      ]);

      const res = await request(app).get(`/api/projects/${project._id}/tasks`);

      expect(res.status).toBe(200);
      expect(res.body.data.every((t: { project: string }) => t.project === project._id.toString())).toBe(true);
    });
  });

  describe('GET /api/tasks/cursor', () => {
    it('returns cursor-paginated tasks with hasMore and nextCursor', async () => {
      const { user, project } = await seedUserAndProject();
      const app = createTestApp(user._id.toString());

      await Task.create([
        { title: 'Cursor Task A', description: 'desc', assignee: user._id, project: project._id },
        { title: 'Cursor Task B', description: 'desc', assignee: user._id, project: project._id },
      ]);

      const res = await request(app).get('/api/tasks/cursor');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('hasMore');
      expect(res.body).toHaveProperty('nextCursor');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('accepts cursor and limit query params', async () => {
      const { user, project } = await seedUserAndProject();
      const app = createTestApp(user._id.toString());

      await Task.create([
        { title: 'Limited Task A', description: 'desc', assignee: user._id, project: project._id },
        { title: 'Limited Task B', description: 'desc', assignee: user._id, project: project._id },
        { title: 'Limited Task C', description: 'desc', assignee: user._id, project: project._id },
      ]);

      const res = await request(app).get('/api/tasks/cursor?limit=2');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
    });

    it('uses cursor to paginate through results', async () => {
      const { user, project } = await seedUserAndProject();
      const app = createTestApp(user._id.toString());

      await Task.create([
        { title: 'Page1 Task A', description: 'desc', assignee: user._id, project: project._id },
        { title: 'Page1 Task B', description: 'desc', assignee: user._id, project: project._id },
      ]);

      const firstPage = await request(app).get('/api/tasks/cursor?limit=1');
      expect(firstPage.status).toBe(200);

      if (firstPage.body.nextCursor) {
        const secondPage = await request(app).get(
          `/api/tasks/cursor?cursor=${firstPage.body.nextCursor}&limit=1`,
        );
        expect(secondPage.status).toBe(200);
      }
    });
  });

  describe('POST /api/tasks — with optional fields', () => {
    it('creates a task with a future dueDate', async () => {
      const { user, project } = await seedUserAndProject();
      const app = createTestApp(user._id.toString());
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const res = await request(app)
        .post('/api/tasks')
        .send({
          title: 'Task with Due Date',
          description: 'Has a due date in the future',
          assignee: user._id.toString(),
          project: project._id.toString(),
          dueDate: futureDate,
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('title', 'Task with Due Date');
    });

    it('returns 422 for a past dueDate', async () => {
      const { user, project } = await seedUserAndProject();
      const app = createTestApp(user._id.toString());
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const res = await request(app)
        .post('/api/tasks')
        .send({
          title: 'Past Due Task',
          description: 'has a past due date',
          assignee: user._id.toString(),
          project: project._id.toString(),
          dueDate: pastDate,
        });

      expect(res.status).toBe(422);
    });
  });

  describe('GET /api/tasks — with page and limit', () => {
    it('uses provided page and limit params', async () => {
      const { user, project } = await seedUserAndProject();
      const app = createTestApp(user._id.toString());

      await Task.create([
        { title: 'Paged Task A', description: 'desc', assignee: user._id, project: project._id },
        { title: 'Paged Task B', description: 'desc', assignee: user._id, project: project._id },
      ]);

      const res = await request(app).get('/api/tasks?page=1&limit=5');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('page', 1);
      expect(res.body).toHaveProperty('limit', 5);
    });
  });

  describe('GET /api/tasks/export/csv — with filters', () => {
    it('exports CSV filtered by status and priority', async () => {
      const { user, project } = await seedUserAndProject();
      const app = createTestApp(user._id.toString());

      await Task.create({
        title: 'High Priority Done', description: 'desc',
        assignee: user._id, project: project._id,
        status: 'done', priority: 'high',
      });

      const res = await request(app).get('/api/tasks/export/csv?status=done&priority=high');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
    });
  });
});
