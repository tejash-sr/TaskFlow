import { Types } from 'mongoose';
import { AppError } from '@/utils/AppError';
import { ProjectService } from '@/services/project.service';

jest.mock('@/models/Project.model');
jest.mock('@/models/Task.model');
jest.mock('@/models/User.model');
jest.mock('@/queues/emailQueue');

import Project from '@/models/Project.model';
import Task from '@/models/Task.model';
import User from '@/models/User.model';
import { enqueueEmail } from '@/queues/emailQueue';

const MockedProject = Project as jest.Mocked<typeof Project>;
const MockedTask = Task as jest.Mocked<typeof Task>;
const MockedUser = User as jest.Mocked<typeof User>;
const mockEnqueueEmail = enqueueEmail as jest.MockedFunction<typeof enqueueEmail>;

function makeId() {
  return new Types.ObjectId();
}

function makeProject(overrides: Record<string, unknown> = {}) {
  const ownerId = makeId();
  const memberId = makeId();
  return {
    _id: makeId(),
    name: 'Test Project',
    description: 'A test project',
    owner: ownerId,
    members: [memberId],
    toObject: jest.fn().mockReturnValue({ _id: makeId(), name: 'Test Project' }),
    save: jest.fn().mockResolvedValue(undefined),
    populate: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    _id: makeId(),
    name: 'Test User',
    email: 'user@test.com',
    ...overrides,
  };
}

describe('ProjectService', () => {
  let service: ProjectService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ProjectService();
    mockEnqueueEmail.mockResolvedValue(undefined as never);
  });

  describe('findAll', () => {
    it('returns projects with task counts', async () => {
      const project = makeProject();
      project.toObject.mockReturnValue({ _id: project._id, name: project.name, taskCount: 0 });

      (MockedProject.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue([project]),
          }),
        }),
      });

      (MockedTask.aggregate as jest.Mock).mockResolvedValue([
        { _id: project._id, count: 3 },
      ]);

      const result = await service.findAll();
      expect(result).toHaveLength(1);
      expect(result[0].taskCount).toBe(3);
    });

    it('returns empty array when no projects exist', async () => {
      (MockedProject.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      (MockedTask.aggregate as jest.Mock).mockResolvedValue([]);

      const result = await service.findAll();
      expect(result).toHaveLength(0);
    });

    it('assigns taskCount 0 when project has no tasks in aggregate', async () => {
      const project = makeProject();
      project.toObject.mockReturnValue({ _id: project._id, name: project.name, taskCount: 0 });

      (MockedProject.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue([project]),
          }),
        }),
      });

      // aggregate returns empty (no tasks for this project)
      (MockedTask.aggregate as jest.Mock).mockResolvedValue([]);

      const result = await service.findAll();
      expect(result[0].taskCount).toBe(0);
    });
  });

  describe('create', () => {
    it('creates a project with owner as member', async () => {
      const ownerId = makeId().toString();
      const project = makeProject({ owner: new Types.ObjectId(ownerId) });

      (MockedProject.create as jest.Mock).mockResolvedValue(project);

      const result = await service.create(
        { name: 'New Project', description: 'New desc' },
        ownerId,
      );

      expect(MockedProject.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Project' }),
      );
    });

    it('deduplicates members when owner is in the members array', async () => {
      const ownerId = makeId().toString();
      const project = makeProject({ owner: new Types.ObjectId(ownerId) });

      (MockedProject.create as jest.Mock).mockResolvedValue(project);

      await service.create(
        { name: 'Dedup Project', description: 'desc', members: [ownerId, makeId().toString()] },
        ownerId,
      );

      // Call should deduplicate the ownerId so it's only in members once
      const callArg = (MockedProject.create as jest.Mock).mock.calls[0][0];
      const ownerObjId = new Types.ObjectId(ownerId).toString();
      const memberStrings = callArg.members.map((m: Types.ObjectId) => m.toString());
      const ownerOccurrences = memberStrings.filter((m: string) => m === ownerObjId).length;
      expect(ownerOccurrences).toBe(1);
    });
  });

  describe('findById', () => {
    it('throws 404 when project does not exist', async () => {
      (MockedProject.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(service.findById(makeId().toString())).rejects.toMatchObject({ statusCode: 404 });
    });

    it('returns the project when found', async () => {
      const project = makeProject();
      (MockedProject.findById as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(project),
        }),
      });

      const result = await service.findById(project._id.toString());
      expect(result).toBeDefined();
    });
  });

  describe('addMember', () => {
    it('throws 404 when user does not exist', async () => {
      // Mock the dynamic import of User model
      jest.doMock('@/models/User.model', () => ({
        default: { findOne: jest.fn().mockResolvedValue(null) },
      }));

      (MockedUser.findOne as jest.Mock).mockResolvedValue(null);

      // Patch the dynamic import by making findOne return null
      const mockUser = { findOne: jest.fn().mockResolvedValue(null) };
      jest.mock('@/models/User.model', () => ({ default: mockUser }));

      await expect(
        service.addMember(makeId().toString(), 'notfound@test.com', makeId().toString()),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 409 when user is already a member', async () => {
      const userId = makeId();
      const user = makeUser({ _id: userId });
      const requesterId = makeId();
      const project = makeProject({
        owner: requesterId,
        members: [userId],
      });

      (MockedUser.findOne as jest.Mock).mockResolvedValue(user);
      (MockedProject.findById as jest.Mock).mockResolvedValue(project);

      await expect(
        service.addMember(project._id.toString(), user.email, requesterId.toString()),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('throws 403 when requester is not the owner', async () => {
      const userId = makeId();
      const user = makeUser({ _id: userId });
      const ownerId = makeId();
      const requesterId = makeId(); // different from owner
      const project = makeProject({
        owner: ownerId,
        members: [],
      });

      (MockedUser.findOne as jest.Mock).mockResolvedValue(user);
      (MockedProject.findById as jest.Mock).mockResolvedValue(project);

      await expect(
        service.addMember(project._id.toString(), user.email, requesterId.toString()),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('adds the member and sends email when requester is owner', async () => {
      const userId = makeId();
      const user = makeUser({ _id: userId });
      const requesterId = makeId();
      const project = makeProject({
        owner: requesterId,
        members: [],
      });
      project.save.mockResolvedValue(project as never);
      project.populate.mockResolvedValue(project as never);

      (MockedUser.findOne as jest.Mock).mockResolvedValue(user);
      (MockedProject.findById as jest.Mock).mockResolvedValue(project);
      (MockedUser.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({ name: 'Owner Name' }),
      });

      await service.addMember(project._id.toString(), user.email, requesterId.toString());

      expect(project.save).toHaveBeenCalled();
      expect(mockEnqueueEmail).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'projectMemberAdded' }),
      );
    });
  });

  describe('removeMember', () => {
    it('throws 404 when project does not exist', async () => {
      (MockedProject.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        service.removeMember(makeId().toString(), makeId().toString(), makeId().toString()),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 403 when requester is not the owner', async () => {
      const ownerId = makeId();
      const requesterId = makeId(); // different from owner
      const project = makeProject({ owner: ownerId });

      (MockedProject.findById as jest.Mock).mockResolvedValue(project);

      await expect(
        service.removeMember(project._id.toString(), makeId().toString(), requesterId.toString()),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('removes the member when requester is owner', async () => {
      const ownerId = makeId();
      const memberId = makeId();
      const project = makeProject({ owner: ownerId, members: [memberId] });
      project.save.mockResolvedValue(project as never);
      project.populate.mockResolvedValue(project as never);

      (MockedProject.findById as jest.Mock).mockResolvedValue(project);

      await service.removeMember(project._id.toString(), memberId.toString(), ownerId.toString());

      expect(project.save).toHaveBeenCalled();
    });
  });

  describe('deleteProject', () => {
    it('throws 404 when project does not exist', async () => {
      (MockedProject.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        service.deleteProject(makeId().toString(), makeId().toString()),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 403 when requester is not the owner', async () => {
      const ownerId = makeId();
      const requesterId = makeId();
      const project = makeProject({ owner: ownerId });

      (MockedProject.findById as jest.Mock).mockResolvedValue(project);

      await expect(
        service.deleteProject(project._id.toString(), requesterId.toString()),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('soft-deletes tasks and deletes project when requester is owner', async () => {
      const ownerId = makeId();
      const project = makeProject({ owner: ownerId });

      (MockedProject.findById as jest.Mock).mockResolvedValue(project);
      (MockedTask.updateMany as jest.Mock).mockResolvedValue({});
      (MockedProject.findByIdAndDelete as jest.Mock).mockResolvedValue(project);

      await service.deleteProject(project._id.toString(), ownerId.toString());

      expect(MockedTask.updateMany).toHaveBeenCalled();
      expect(MockedProject.findByIdAndDelete).toHaveBeenCalledWith(project._id.toString());
    });
  });

  describe('getProjectTasks', () => {
    it('throws 404 when project does not exist', async () => {
      (MockedProject.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getProjectTasks(makeId().toString(), 1, 20),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('returns paginated tasks for a valid project', async () => {
      const project = makeProject();
      (MockedProject.findById as jest.Mock).mockResolvedValue(project);

      const tasks = [{ _id: makeId(), title: 'Task 1' }];
      (MockedTask.find as jest.Mock).mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(tasks),
          }),
        }),
      });
      (MockedTask.countDocuments as jest.Mock).mockResolvedValue(1);

      const result = await service.getProjectTasks(project._id.toString(), 1, 20);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});
