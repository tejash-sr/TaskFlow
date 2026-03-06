import { Types } from 'mongoose';

jest.mock('@/models/Task.model');
jest.mock('@/queues/emailQueue');

import Task from '@/models/Task.model';
import { enqueueEmail } from '@/queues/emailQueue';
import { getUsersWithOverdueTasks, runDailyDigest } from '@/services/digest.service';

const MockedTask = Task as jest.Mocked<typeof Task>;
const mockEnqueueEmail = enqueueEmail as jest.MockedFunction<typeof enqueueEmail>;

function makeId() {
  return new Types.ObjectId();
}

function makeOverdueTask(assigneeId: Types.ObjectId, assigneeName: string, assigneeEmail: string) {
  return {
    _id: makeId(),
    title: 'Overdue Task',
    dueDate: new Date('2020-01-01'),
    status: 'todo',
    assignee: {
      _id: assigneeId,
      name: assigneeName,
      email: assigneeEmail,
    },
  };
}

describe('DigestService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockEnqueueEmail.mockResolvedValue(undefined as never);
  });

  describe('getUsersWithOverdueTasks', () => {
    it('returns empty array when no overdue tasks exist', async () => {
      (MockedTask.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue([]),
      });

      const result = await getUsersWithOverdueTasks();
      expect(result).toHaveLength(0);
    });

    it('returns one entry with overdueCount 1 for a single overdue task', async () => {
      const userId = makeId();
      const task = makeOverdueTask(userId, 'Alice', 'alice@test.com');

      (MockedTask.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue([task]),
      });

      const result = await getUsersWithOverdueTasks();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        userId: userId.toString(),
        name: 'Alice',
        email: 'alice@test.com',
        overdueCount: 1,
      });
    });

    it('aggregates multiple overdue tasks for the same user', async () => {
      const userId = makeId();
      const task1 = makeOverdueTask(userId, 'Bob', 'bob@test.com');
      const task2 = makeOverdueTask(userId, 'Bob', 'bob@test.com');
      const task3 = makeOverdueTask(userId, 'Bob', 'bob@test.com');

      (MockedTask.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue([task1, task2, task3]),
      });

      const result = await getUsersWithOverdueTasks();
      expect(result).toHaveLength(1);
      expect(result[0].overdueCount).toBe(3);
    });

    it('returns separate entries for different users', async () => {
      const userId1 = makeId();
      const userId2 = makeId();
      const task1 = makeOverdueTask(userId1, 'Alice', 'alice@test.com');
      const task2 = makeOverdueTask(userId2, 'Bob', 'bob@test.com');

      (MockedTask.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue([task1, task2]),
      });

      const result = await getUsersWithOverdueTasks();
      expect(result).toHaveLength(2);
    });

    it('skips tasks with no assignee', async () => {
      const task = {
        _id: makeId(),
        title: 'No assignee task',
        assignee: null,
      };

      (MockedTask.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue([task]),
      });

      const result = await getUsersWithOverdueTasks();
      expect(result).toHaveLength(0);
    });
  });

  describe('runDailyDigest', () => {
    it('returns empty and enqueues no emails when no overdue tasks', async () => {
      (MockedTask.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue([]),
      });

      const result = await runDailyDigest();
      expect(result).toHaveLength(0);
      expect(mockEnqueueEmail).not.toHaveBeenCalled();
    });

    it('enqueues one email per distinct user with overdue tasks', async () => {
      const userId1 = makeId();
      const userId2 = makeId();
      const task1 = makeOverdueTask(userId1, 'Alice', 'alice@test.com');
      const task2 = makeOverdueTask(userId2, 'Bob', 'bob@test.com');
      const task3 = makeOverdueTask(userId1, 'Alice', 'alice@test.com'); // second task for Alice

      (MockedTask.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue([task1, task2, task3]),
      });

      const result = await runDailyDigest();
      expect(result).toHaveLength(2);
      expect(mockEnqueueEmail).toHaveBeenCalledTimes(2);
    });

    it('enqueues dailyDigest email type with correct fields', async () => {
      const userId = makeId();
      const task = makeOverdueTask(userId, 'Carol', 'carol@test.com');
      task._id = makeId(); // reassign to simulate second overdue task
      const task2 = makeOverdueTask(userId, 'Carol', 'carol@test.com');

      (MockedTask.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue([task, task2]),
      });

      await runDailyDigest();

      expect(mockEnqueueEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dailyDigest',
          to: 'carol@test.com',
          name: 'Carol',
          overdueCount: 2,
        }),
      );
    });

    it('returns the list of digest entries', async () => {
      const userId = makeId();
      const task = makeOverdueTask(userId, 'Dave', 'dave@test.com');

      (MockedTask.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockResolvedValue([task]),
      });

      const result = await runDailyDigest();
      expect(result[0]).toMatchObject({
        name: 'Dave',
        email: 'dave@test.com',
        overdueCount: 1,
      });
    });
  });
});
