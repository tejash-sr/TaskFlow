import { TaskService } from '@/services/task.service';
import Task from '@/models/Task.model';
import Project from '@/models/Project.model';
import { AppError } from '@/utils/AppError';
import { Types } from 'mongoose';

jest.mock('@/models/Task.model');
jest.mock('@/models/Project.model');

const MockedTask = Task as jest.Mocked<typeof Task>;
const MockedProject = Project as jest.Mocked<typeof Project>;

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
});
