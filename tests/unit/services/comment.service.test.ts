import { Types } from 'mongoose';

// Use factory mocks so Mongoose model compilation is never triggered
const mockCommentCreate = jest.fn();
const mockCommentFindById = jest.fn();
const mockCommentFind = jest.fn();
const mockCommentFindByIdAndDelete = jest.fn();

jest.mock('@/models/Comment.model', () => ({
  __esModule: true,
  default: {
    create: (...args: unknown[]) => mockCommentCreate(...args),
    findById: (...args: unknown[]) => mockCommentFindById(...args),
    find: (...args: unknown[]) => mockCommentFind(...args),
    findByIdAndDelete: (...args: unknown[]) => mockCommentFindByIdAndDelete(...args),
  },
}));

const mockTaskFindOne = jest.fn();
jest.mock('@/models/Task.model', () => ({
  __esModule: true,
  default: {
    findOne: (...args: unknown[]) => mockTaskFindOne(...args),
  },
}));

const mockUserFindById = jest.fn();
jest.mock('@/models/User.model', () => ({
  __esModule: true,
  default: {
    findById: (...args: unknown[]) => mockUserFindById(...args),
  },
}));

const mockEnqueueEmail = jest.fn();
jest.mock('@/queues/emailQueue', () => ({
  __esModule: true,
  enqueueEmail: (...args: unknown[]) => mockEnqueueEmail(...args),
}));

import { CommentService } from '@/services/comment.service';

function makeObjectId() {
  return new Types.ObjectId();
}

function makeComment(overrides: Record<string, unknown> = {}) {
  const authorId = makeObjectId();
  return {
    _id: makeObjectId(),
    content: 'Test comment',
    author: authorId,
    task: makeObjectId(),
    populate: jest.fn().mockResolvedValue({ _id: makeObjectId(), content: 'Test comment', author: { name: 'Alice', email: 'alice@test.com' } }),
    ...overrides,
  };
}

function makeTask(overrides: Record<string, unknown> = {}) {
  const assigneeId = makeObjectId();
  return {
    _id: makeObjectId(),
    title: 'Test Task',
    assignee: { _id: assigneeId, name: 'Assignee User', email: 'assignee@test.com' },
    project: { name: 'Test Project' },
    ...overrides,
  };
}

describe('CommentService', () => {
  let service: CommentService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new CommentService();
    mockEnqueueEmail.mockResolvedValue(undefined as never);
  });

  describe('create', () => {
    it('throws 404 when task does not exist', async () => {
      mockTaskFindOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        service.create(makeObjectId().toString(), makeObjectId().toString(), { content: 'Hello' }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('creates a comment and returns it populated', async () => {
      const assigneeId = makeObjectId();
      // use assigneeId as authorId to skip email code path
      const task = makeTask({ assignee: { _id: assigneeId, name: 'User', email: 'u@test.com' } });

      mockTaskFindOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(task),
        }),
      });

      const comment = makeComment({ author: assigneeId });
      mockCommentCreate.mockResolvedValue(comment);

      await service.create(task._id.toString(), assigneeId.toString(), { content: 'Hello' });

      expect(mockCommentCreate).toHaveBeenCalled();
      expect(comment.populate).toHaveBeenCalledWith('author', 'name email avatar');
    });

    it('sends email notification when commenter is different from assignee', async () => {
      const authorId = makeObjectId(); // different from assignee
      const task = makeTask();

      mockTaskFindOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(task),
        }),
      });

      const comment = makeComment({ author: authorId });
      mockCommentCreate.mockResolvedValue(comment);
      mockUserFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ name: 'Alice' }) }),
      });

      await service.create(task._id.toString(), authorId.toString(), { content: 'Hey' });

      expect(mockEnqueueEmail).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'commentAdded' }),
      );
    });

    it('does NOT send email when author is the task assignee', async () => {
      const assigneeId = makeObjectId();
      const task = makeTask({
        assignee: { _id: assigneeId, name: 'Assignee', email: 'assignee@test.com' },
      });

      mockTaskFindOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(task),
        }),
      });

      const comment = makeComment({ author: assigneeId });
      mockCommentCreate.mockResolvedValue(comment);

      // authorId same as assigneeId => no email
      await service.create(task._id.toString(), assigneeId.toString(), { content: 'My own comment' });

      expect(mockEnqueueEmail).not.toHaveBeenCalled();
    });

    it('does NOT send email when task has no assignee', async () => {
      const authorId = makeObjectId();
      const task = makeTask({ assignee: null });

      mockTaskFindOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(task),
        }),
      });

      const comment = makeComment({ author: authorId });
      mockCommentCreate.mockResolvedValue(comment);

      await service.create(task._id.toString(), authorId.toString(), { content: 'Comment' });

      expect(mockEnqueueEmail).not.toHaveBeenCalled();
    });

    it('creates a comment with a parent reference', async () => {
      const authorId = makeObjectId();
      const parentId = makeObjectId();
      const task = makeTask({ assignee: null });

      mockTaskFindOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(task),
        }),
      });

      const comment = makeComment({ author: authorId, parent: parentId });
      mockCommentCreate.mockResolvedValue(comment);

      await service.create(task._id.toString(), authorId.toString(), {
        content: 'Reply comment',
        parent: parentId.toString(),
      });

      expect(mockCommentCreate).toHaveBeenCalledWith(
        expect.objectContaining({ parent: parentId.toString() }),
      );
    });
  });

  describe('deleteComment', () => {
    it('throws 404 when comment does not exist', async () => {
      mockCommentFindById.mockResolvedValue(null);

      await expect(
        service.deleteComment(makeObjectId().toString(), makeObjectId().toString()),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 403 when requester is not the author', async () => {
      const authorId = makeObjectId();
      const differentUserId = makeObjectId();
      const comment = makeComment({ author: authorId });

      mockCommentFindById.mockResolvedValue(comment);

      await expect(
        service.deleteComment(comment._id.toString(), differentUserId.toString()),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('deletes the comment when requester is the author', async () => {
      const authorId = makeObjectId();
      const comment = makeComment({ author: authorId });

      mockCommentFindById.mockResolvedValue(comment);
      mockCommentFindByIdAndDelete.mockResolvedValue(comment);

      await service.deleteComment(comment._id.toString(), authorId.toString());

      expect(mockCommentFindByIdAndDelete).toHaveBeenCalledWith(comment._id.toString());
    });
  });

  describe('findByTask', () => {
    it('throws 404 when task does not exist', async () => {
      mockTaskFindOne.mockResolvedValue(null);

      await expect(
        service.findByTask(makeObjectId().toString()),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('returns sorted comments for a valid task', async () => {
      const task = makeTask();
      mockTaskFindOne.mockResolvedValue(task);

      const comments = [makeComment(), makeComment()];
      mockCommentFind.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue(comments),
        }),
      });

      const result = await service.findByTask(task._id.toString());
      expect(result).toHaveLength(2);
    });

    it('returns empty array when task has no comments', async () => {
      const task = makeTask();
      mockTaskFindOne.mockResolvedValue(task);

      mockCommentFind.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.findByTask(task._id.toString());
      expect(result).toHaveLength(0);
    });
  });
});
