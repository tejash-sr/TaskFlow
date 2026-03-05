import { Types } from 'mongoose';
import Task from '@/models/Task.model';
import User from '@/models/User.model';
import Project from '@/models/Project.model';

async function createUserAndProject() {
  const user = await new User({
    email: `u${Date.now()}@example.com`,
    password: 'password123',
    name: 'Task Test User',
  }).save();

  const project = await new Project({
    name: 'Test Project',
    description: 'A project for testing',
    owner: user._id,
    members: [user._id],
  }).save();

  return { user, project };
}

describe('Task model', () => {
  describe('validation', () => {
    it('saves a task with valid data', async () => {
      const { user, project } = await createUserAndProject();
      const task = await new Task({
        title: 'Valid Task',
        description: 'A valid task description',
        assignee: user._id,
        project: project._id,
      }).save();

      expect(task._id).toBeDefined();
      expect(task.status).toBe('todo');
      expect(task.priority).toBe('medium');
    });

    it('fails when title is missing', async () => {
      const { user, project } = await createUserAndProject();
      const task = new Task({ description: 'desc', assignee: user._id, project: project._id });
      await expect(task.save()).rejects.toThrow();
    });

    it('fails when title is shorter than 3 characters', async () => {
      const { user, project } = await createUserAndProject();
      const task = new Task({
        title: 'AB',
        description: 'desc',
        assignee: user._id,
        project: project._id,
      });
      await expect(task.save()).rejects.toThrow();
    });

    it('fails when description is missing', async () => {
      const { user, project } = await createUserAndProject();
      const task = new Task({ title: 'Valid Title', assignee: user._id, project: project._id });
      await expect(task.save()).rejects.toThrow();
    });

    it('fails with an invalid status enum value', async () => {
      const { user, project } = await createUserAndProject();
      const task = new Task({
        title: 'Status Test',
        description: 'desc',
        assignee: user._id,
        project: project._id,
        status: 'invalid-status',
      });
      await expect(task.save()).rejects.toThrow();
    });

    it('fails with an invalid priority enum value', async () => {
      const { user, project } = await createUserAndProject();
      const task = new Task({
        title: 'Priority Test',
        description: 'desc',
        assignee: user._id,
        project: project._id,
        priority: 'critical',
      });
      await expect(task.save()).rejects.toThrow();
    });

    it('fails when tags exceed the maximum of 10', async () => {
      const { user, project } = await createUserAndProject();
      const task = new Task({
        title: 'Tags Test',
        description: 'desc',
        assignee: user._id,
        project: project._id,
        tags: Array(11).fill('tag'),
      });
      await expect(task.save()).rejects.toThrow();
    });

    it('fails when dueDate is in the past on creation', async () => {
      const { user, project } = await createUserAndProject();
      const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const task = new Task({
        title: 'Due Date Test',
        description: 'desc',
        assignee: user._id,
        project: project._id,
        dueDate: past,
      });
      await expect(task.save()).rejects.toThrow('Due date must be a future date');
    });
  });

  describe('completedAt hook', () => {
    it('sets completedAt when status changes to done', async () => {
      const { user, project } = await createUserAndProject();
      const task = await new Task({
        title: 'Complete Me',
        description: 'desc',
        assignee: user._id,
        project: project._id,
      }).save();

      expect(task.completedAt).toBeUndefined();

      task.status = 'done';
      await task.save();

      expect(task.completedAt).toBeInstanceOf(Date);
    });

    it('does not set completedAt when status is not done', async () => {
      const { user, project } = await createUserAndProject();
      const task = await new Task({
        title: 'In Progress',
        description: 'desc',
        assignee: user._id,
        project: project._id,
      }).save();

      task.status = 'in-progress';
      await task.save();

      expect(task.completedAt).toBeUndefined();
    });
  });

  describe('static methods', () => {
    it('findOverdue returns tasks past dueDate that are not done', async () => {
      const { user, project } = await createUserAndProject();

      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const activeTask = await new Task({
        title: 'Future Task',
        description: 'desc',
        assignee: user._id,
        project: project._id,
        dueDate: futureDate,
      }).save();

      activeTask.dueDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await Task.updateOne({ _id: activeTask._id }, { dueDate: activeTask.dueDate });

      const overdueResults = await Task.findOverdue();
      const ids = overdueResults.map((t) => t._id.toString());
      expect(ids).toContain(activeTask._id.toString());
    });

    it('findOverdue excludes done tasks', async () => {
      const { user, project } = await createUserAndProject();

      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const doneTask = await new Task({
        title: 'Done Overdue',
        description: 'desc',
        assignee: user._id,
        project: project._id,
        dueDate: futureDate,
        status: 'done',
      }).save();

      await Task.updateOne({ _id: doneTask._id }, { dueDate: new Date(Date.now() - 1000) });

      const overdueResults = await Task.findOverdue();
      const ids = overdueResults.map((t) => t._id.toString());
      expect(ids).not.toContain(doneTask._id.toString());
    });

    it('getStatusCounts aggregates task counts by status', async () => {
      const { user, project } = await createUserAndProject();

      await Task.create([
        { title: 'First Todo Task', description: 'desc', assignee: user._id, project: project._id, status: 'todo' },
        { title: 'Second Todo Task', description: 'desc', assignee: user._id, project: project._id, status: 'todo' },
        { title: 'In Progress Task', description: 'desc', assignee: user._id, project: project._id, status: 'in-progress' },
        { title: 'Completed Task', description: 'desc', assignee: user._id, project: project._id, status: 'done' },
      ]);

      const counts = await Task.getStatusCounts(project._id);

      expect(counts.todo).toBe(2);
      expect(counts['in-progress']).toBe(1);
      expect(counts.done).toBe(1);
      expect(counts.review).toBe(0);
    });
  });
});
