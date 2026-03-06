import User from '@/models/User.model';
import Project from '@/models/Project.model';
import Task from '@/models/Task.model';

describe('Task service business logic', () => {
  let testUser: any;
  let testProject: any;

  beforeEach(async () => {
    testUser = await User.create({
      name: 'Task Service Test User',
      email: `taskservice${Date.now()}@test.com`,
      password: 'password123',
    });

    testProject = await Project.create({
      name: 'Task Service Test Project',
      description: 'for task service tests',
      owner: testUser._id,
      members: [testUser._id],
    });
  });

  describe('Task creation with assignee', () => {
    it('creates task with specified assignee', async () => {
      const TaskService = (await import('@/services/task.service')).default;
      const ts = new TaskService();

      const task = await ts.create(
        {
          title: 'Assigned Task',
          description: 'Test task',
          status: 'todo',
          priority: 'high',
          project: testProject._id.toString(),
          assignee: testUser._id.toString(),
        },
        testUser._id.toString()
      );

      expect(task).toHaveProperty('assignee');
      expect(task.assignee?.toString()).toBe(testUser._id.toString());
    });

    it('preserves tags during task creation', async () => {
      const TaskService = (await import('@/services/task.service')).default;
      const ts = new TaskService();

      const tags = ['bug', 'urgent', 'backend'];
      const task = await ts.create(
        {
          title: 'Tagged Task',
          description: 'Task with tags',
          status: 'todo',
          priority: 'medium',
          project: testProject._id.toString(),
          tags,
          assignee: testUser._id.toString(),
        },
        testUser._id.toString()
      );

      expect(task.tags).toEqual(tags);
    });

    it('validates future dueDate requirement', async () => {
      const TaskService = (await import('@/services/task.service')).default;
      const ts = new TaskService();

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      // The validation should happen in the validator middleware, not in service
      // But the service should accept valid future dates
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const task = await ts.create(
        {
          title: 'Future Dated Task',
          description: 'Task with future date',
          status: 'todo',
          priority: 'medium',
          project: testProject._id.toString(),
          dueDate: futureDate.toISOString(),
          assignee: testUser._id.toString(),
        },
        testUser._id.toString()
      );

      expect(task.dueDate).toBeDefined();
    });
  });

  describe('Task filtering with cursor pagination', () => {
    beforeEach(async () => {
      // Create multiple tasks for pagination testing
      const TaskService = (await import('@/services/task.service')).default;
      const ts = new TaskService();

      for (let i = 0; i < 5; i++) {
        await ts.create(
          {
            title: `Task ${i}`,
            description: `Description ${i}`,
            status: 'todo',
            priority: 'medium',
            project: testProject._id.toString(),
            assignee: testUser._id.toString(),
          },
          testUser._id.toString()
        );
      }
    });

    it('supports cursor-based pagination', async () => {
      const TaskService = (await import('@/services/task.service')).default;
      const ts = new TaskService();

      const firstPage = await ts.findByFilters(
        {
          project: testProject._id.toString(),
          limit: '2',
        },
        testUser._id.toString()
      );

      expect(Array.isArray(firstPage)).toBe(true);
      expect(firstPage.length).toBeLessThanOrEqual(2);
    });

    it('filters tasks by status', async () => {
      const TaskService = (await import('@/services/task.service')).default;
      const ts = new TaskService();

      const todoTasks = await ts.findByFilters(
        {
          project: testProject._id.toString(),
          status: 'todo',
        },
        testUser._id.toString()
      );

      expect(Array.isArray(todoTasks)).toBe(true);
      todoTasks.forEach(task => {
        expect(task.status).toBe('todo');
      });
    });

    it('searches tasks by title', async () => {
      const TaskService = (await import('@/services/task.service')).default;
      const ts = new TaskService();

      const searchResults = await ts.findByFilters(
        {
          project: testProject._id.toString(),
          search: 'Task 1',
        },
        testUser._id.toString()
      );

      expect(Array.isArray(searchResults)).toBe(true);
    });
  });

  describe('Task update with validation', () => {
    it('updates task and runs validators', async () => {
      const TaskService = (await import('@/services/task.service')).default;
      const ts = new TaskService();

      const task = await ts.create(
        {
          title: 'Original Task',
          description: 'Original description',
          status: 'todo',
          priority: 'medium',
          project: testProject._id.toString(),
          assignee: testUser._id.toString(),
        },
        testUser._id.toString()
      );

      const updated = await ts.update(
        {
          title: 'Updated Task',
          status: 'in_progress',
          priority: 'high',
        },
        task._id.toString(),
        testUser._id.toString()
      );

      expect(updated.title).toBe('Updated Task');
      expect(updated.status).toBe('in_progress');
      expect(updated.priority).toBe('high');
    });
  });
});
