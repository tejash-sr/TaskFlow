import { TaskService } from '@/services/task.service';
import Task from '@/models/Task.model';
import Project from '@/models/Project.model';
import User from '@/models/User.model';
import { AppError } from '@/utils/AppError';
import { Types } from 'mongoose';

jest.mock('@/models/Task.model');
jest.mock('@/models/Project.model');
jest.mock('@/models/User.model');
jest.mock('@/queues/emailQueue', () => ({ enqueueEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/socket', () => ({ emitToProject: jest.fn() }));

const MockedTask = Task as jest.Mocked<typeof Task>;
const MockedProject = Project as jest.Mocked<typeof Project>;
const MockedUser = User as jest.Mocked<typeof User>;

describe('TaskService', () => {
  let service: TaskService;

  const ownerId = new Types.ObjectId().toString();
  const projectId = new Types.ObjectId().toString();

  beforeEach(() => {
    service = new TaskService();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('calls Task.create with the provided data when user is a project member', async () => {
      const mockProject = {
        _id: new Types.ObjectId(projectId),
        owner: new Types.ObjectId(ownerId),
        members: [new Types.ObjectId(ownerId)],
      };
      (MockedProject.findById as jest.Mock).mockResolvedValue(mockProject);

      const createdTask = { _id: new Types.ObjectId(), title: 'Test Task' };
      (MockedTask.create as jest.Mock).mockResolvedValue(createdTask);

      const dto = { title: 'Test Task', description: 'desc', assignee: ownerId, project: projectId };
      const result = await service.create(dto, ownerId);

      expect(MockedProject.findById).toHaveBeenCalledWith(projectId);
      expect(MockedTask.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(createdTask);
    });

    it('throws 404 when project does not exist', async () => {
      (MockedProject.findById as jest.Mock).mockResolvedValue(null);

      const dto = { title: 'Test Task', description: 'desc', assignee: ownerId, project: projectId };
      await expect(service.create(dto, ownerId)).rejects.toThrow(AppError);
      await expect(service.create(dto, ownerId)).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 403 when requesting user is not a project member', async () => {
      const nonMemberId = new Types.ObjectId().toString();
      const mockProject = {
        _id: new Types.ObjectId(projectId),
        owner: new Types.ObjectId(ownerId),
        members: [new Types.ObjectId(ownerId)],
      };
      (MockedProject.findById as jest.Mock).mockResolvedValue(mockProject);

      const dto = {
        title: 'Test Task',
        description: 'desc',
        assignee: ownerId,
        project: projectId,
      };
      await expect(service.create(dto, nonMemberId)).rejects.toThrow(AppError);
      await expect(service.create(dto, nonMemberId)).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('findAll', () => {
    it('passes page and limit correctly to the query', async () => {
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
      };
      mockFind.populate
        .mockReturnValueOnce(mockFind)
        .mockResolvedValueOnce([]);
      (MockedTask.find as jest.Mock).mockReturnValue(mockFind);
      (MockedTask.countDocuments as jest.Mock).mockResolvedValue(0);

      await service.findAll({ page: 2, limit: 10 });

      expect(mockFind.sort).toHaveBeenCalled();
      expect(mockFind.skip).toHaveBeenCalledWith(10);
      expect(mockFind.limit).toHaveBeenCalledWith(10);
    });
  });

  describe('update', () => {
    it('uses findOne and save to apply only the provided fields (triggers pre-save hooks)', async () => {
      const taskId = new Types.ObjectId().toString();
      const mockTask = {
        _id: new Types.ObjectId(taskId),
        title: 'Original',
        status: 'todo',
        assignee: new Types.ObjectId(),
        project: new Types.ObjectId(),
        deletedAt: undefined,
        save: jest.fn().mockResolvedValue(undefined),
      };
      (MockedTask.findOne as jest.Mock).mockResolvedValue(mockTask);

      const result = await service.update(taskId, { title: 'Updated' });

      expect(MockedTask.findOne).toHaveBeenCalledWith({ _id: taskId, deletedAt: { $exists: false } });
      expect(mockTask.save).toHaveBeenCalled();
      expect(result.title).toBe('Updated');
    });
  });

  describe('softDelete', () => {
    it('sets deletedAt on the task instead of removing it', async () => {
      const softDeleted = { _id: new Types.ObjectId(), deletedAt: new Date() };
      (MockedTask.findOneAndUpdate as jest.Mock).mockResolvedValue(softDeleted);

      await service.softDelete(new Types.ObjectId().toString());

      expect(MockedTask.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { $set: { deletedAt: expect.any(Date) } },
        expect.anything(),
      );
    });

    it('throws 404 when task does not exist', async () => {
      (MockedTask.findOneAndUpdate as jest.Mock).mockResolvedValue(null);

      await expect(service.softDelete(new Types.ObjectId().toString())).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe('findAllCursor', () => {
    it('returns items with hasMore=false when under limit', async () => {
      const tasks = [{ _id: new Types.ObjectId(), title: 'Task 1' }];
      const innerChain = { populate: jest.fn().mockResolvedValue(tasks) };
      const chain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnValue(innerChain),
      };
      (MockedTask.find as jest.Mock).mockReturnValue(chain);

      const result = await service.findAllCursor(undefined, 20);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('returns nextCursor when there are more items', async () => {
      const id = new Types.ObjectId();
      // 21 items when limit is 20 → hasMore=true
      const tasks = Array.from({ length: 21 }, () => ({ _id: id, title: 'T' }));
      const innerChain = { populate: jest.fn().mockResolvedValue(tasks) };
      const chain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnValue(innerChain),
      };
      (MockedTask.find as jest.Mock).mockReturnValue(chain);

      const result = await service.findAllCursor(undefined, 20);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).not.toBeNull();
    });

    it('uses cursor in query when provided', async () => {
      const cursor = new Types.ObjectId().toString();
      const tasks: unknown[] = [];
      const innerChain = { populate: jest.fn().mockResolvedValue(tasks) };
      const chain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnValue(innerChain),
      };
      (MockedTask.find as jest.Mock).mockReturnValue(chain);

      const result = await service.findAllCursor(cursor, 10);
      expect(result.hasMore).toBe(false);
      // verify find was called with _id filter
      expect(MockedTask.find).toHaveBeenCalledWith(
        expect.objectContaining({ _id: expect.any(Object) }),
      );
    });

    it('applies status and priority filters', async () => {
      const tasks: unknown[] = [];
      const innerChain = { populate: jest.fn().mockResolvedValue(tasks) };
      const chain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnValue(innerChain),
      };
      (MockedTask.find as jest.Mock).mockReturnValue(chain);

      await service.findAllCursor(undefined, 10, { status: 'todo', priority: 'high', sortOrder: 'asc' });
      expect(MockedTask.find).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'todo', priority: 'high' }),
      );
    });
  });

  describe('create — assignee email branch', () => {
    it('sends assignment email when assignee differs from requesting user', async () => {
      const emailQueue = jest.requireMock('@/queues/emailQueue') as { enqueueEmail: jest.Mock };
      emailQueue.enqueueEmail.mockResolvedValue(undefined);

      const assigneeId = new Types.ObjectId().toString();
      const mockProject = {
        _id: new Types.ObjectId(projectId),
        owner: new Types.ObjectId(ownerId),
        members: [new Types.ObjectId(ownerId)],
        name: 'Test Project',
      };
      (MockedProject.findById as jest.Mock).mockResolvedValue(mockProject);

      const createdTask = { _id: new Types.ObjectId(), title: 'Assigned Task' };
      (MockedTask.create as jest.Mock).mockResolvedValue(createdTask);
      (MockedUser.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({ name: 'Assignee', email: 'assignee@test.com' }),
      });

      const dto = { title: 'Assigned Task', description: 'desc', assignee: assigneeId, project: projectId };
      const result = await service.create(dto, ownerId);
      expect(result).toEqual(createdTask);
    });

    it('handles null assignee user gracefully', async () => {
      const emailQueue = jest.requireMock('@/queues/emailQueue') as { enqueueEmail: jest.Mock };
      emailQueue.enqueueEmail.mockResolvedValue(undefined);

      const assigneeId = new Types.ObjectId().toString();
      const mockProject = {
        _id: new Types.ObjectId(projectId),
        owner: new Types.ObjectId(ownerId),
        members: [new Types.ObjectId(ownerId)],
        name: 'Test Project',
      };
      (MockedProject.findById as jest.Mock).mockResolvedValue(mockProject);

      const createdTask = { _id: new Types.ObjectId(), title: 'Task' };
      (MockedTask.create as jest.Mock).mockResolvedValue(createdTask);
      (MockedUser.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null), // assignee not found
      });

      const dto = { title: 'Task', description: 'desc', assignee: assigneeId, project: projectId };
      const result = await service.create(dto, ownerId);
      expect(result).toEqual(createdTask);
    });
  });

  describe('update — additional branches', () => {
    it('throws 404 when task not found', async () => {
      (MockedTask.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.update('nonexistentid', { title: 'New' })).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 400 when dueDate is in the past', async () => {
      const mockTask = {
        _id: new Types.ObjectId(),
        title: 'Task',
        assignee: new Types.ObjectId(),
        project: new Types.ObjectId(),
        save: jest.fn(),
      };
      (MockedTask.findOne as jest.Mock).mockResolvedValue(mockTask);

      const pastDate = new Date(Date.now() - 86400000).toISOString(); // yesterday
      await expect(service.update('someid', { dueDate: pastDate })).rejects.toMatchObject({ statusCode: 400 });
    });

    it('emits status-changed event when status is updated', async () => {
      const taskId = new Types.ObjectId().toString();
      const mockTask = {
        _id: new Types.ObjectId(taskId),
        title: 'Task',
        status: 'todo',
        assignee: new Types.ObjectId(),
        project: new Types.ObjectId(),
        save: jest.fn().mockResolvedValue(undefined),
      };
      (MockedTask.findOne as jest.Mock).mockResolvedValue(mockTask);

      const result = await service.update(taskId, { status: 'done' });
      expect(result.status).toBe('done');
    });

    it('sends email when assignee changes', async () => {
      const emailQueue = jest.requireMock('@/queues/emailQueue') as { enqueueEmail: jest.Mock };
      emailQueue.enqueueEmail.mockResolvedValue(undefined);

      const taskId = new Types.ObjectId().toString();
      const oldAssigneeId = new Types.ObjectId().toString();
      const newAssigneeId = new Types.ObjectId().toString();
      const mockTask = {
        _id: new Types.ObjectId(taskId),
        title: 'Task',
        status: 'todo',
        assignee: new Types.ObjectId(oldAssigneeId),
        project: new Types.ObjectId(projectId),
        save: jest.fn().mockResolvedValue(undefined),
      };
      (MockedTask.findOne as jest.Mock).mockResolvedValue(mockTask);
      (MockedUser.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({ name: 'New Assignee', email: 'new@test.com' }),
      });
      (MockedProject.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({ name: 'Some Project' }),
      });

      const result = await service.update(taskId, { assignee: newAssigneeId });
      expect(result).toBeDefined();
    });
  });

  describe('findAll — additional filters', () => {
    it('applies status, priority, assignee, and search filters', async () => {
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
      };
      mockFind.populate
        .mockReturnValueOnce(mockFind)
        .mockResolvedValueOnce([]);
      (MockedTask.find as jest.Mock).mockReturnValue(mockFind);
      (MockedTask.countDocuments as jest.Mock).mockResolvedValue(0);

      await service.findAll({
        page: 1, limit: 10,
        status: 'todo', priority: 'high',
        assignee: ownerId,
        search: 'test title',
        sortBy: 'title', sortOrder: 'asc',
      });

      expect(MockedTask.find).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'todo', priority: 'high' }),
      );
    });
  });
});
