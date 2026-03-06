import User from '@/models/User.model';
import Project from '@/models/Project.model';
import Task from '@/models/Task.model';
import Comment from '@/models/Comment.model';

describe('CommentService - extended coverage', () => {
  let testUser: any;
  let testProject: any;
  let testTask: any;

  beforeEach(async () => {
    testUser = await User.create({
      name: 'Comment Test User',
      email: `comment${Date.now()}@test.com`,
      password: 'password123',
    });

    testProject = await Project.create({
      name: 'Comment Test Project',
      description: 'for comment tests',
      owner: testUser._id,
      members: [testUser._id],
    });

    testTask = await Task.create({
      title: 'Comment Test Task',
      description: 'Test task for comments',
      assignee: testUser._id,
      project: testProject._id,
    });
  });

  describe('Comment creation', () => {
    it('creates comment with content', async () => {
      const CommentService = (await import('@/services/comment.service')).CommentService;
      const cs = new CommentService();

      const comment = await cs.create(
        testTask._id.toString(),
        testUser._id.toString(),
        {
          content: 'This is a test comment',
        }
      );

      expect(comment).toHaveProperty('content', 'This is a test comment');
      expect(comment).toHaveProperty('author');
      expect(comment.author?.toString()).toBe(testUser._id.toString());
    });

    it('rejects empty comment content', async () => {
      const CommentService = (await import('@/services/comment.service')).CommentService;
      const cs = new CommentService();

      await expect(
        cs.create(
          testTask._id.toString(),
          testUser._id.toString(),
          {
            content: '',
          }
        )
      ).rejects.toThrow();
    });

    it('creates nested comment reply', async () => {
      const CommentService = (await import('@/services/comment.service')).CommentService;
      const cs = new CommentService();

      const parent = await cs.create(
        testTask._id.toString(),
        testUser._id.toString(),
        {
          content: 'Parent comment',
        }
      );

      const reply = await cs.create(
        testTask._id.toString(),
        testUser._id.toString(),
        {
          content: 'Reply to comment',
          parent: parent._id.toString(),
        }
      );

      expect(reply).toHaveProperty('parent');
      expect(reply.parent?.toString()).toBe(parent._id.toString());
    });
  });

  describe('Comment retrieval', () => {
    beforeEach(async () => {
      const CommentService = (await import('@/services/comment.service')).CommentService;
      const cs = new CommentService();

      for (let i = 0; i < 3; i++) {
        await cs.create(
          testTask._id.toString(),
          testUser._id.toString(),
          {
            content: `Test comment ${i}`,
          }
        );
      }
    });

    it('retrieves all comments for a task', async () => {
      const CommentService = (await import('@/services/comment.service')).CommentService;
      const cs = new CommentService();

      const comments = await cs.findByTaskId(testTask._id.toString());

      expect(Array.isArray(comments)).toBe(true);
      expect(comments.length).toBeGreaterThanOrEqual(3);
    });

    it('includes author information in comments', async () => {
      const CommentService = (await import('@/services/comment.service')).CommentService;
      const cs = new CommentService();

      const comments = await cs.findByTaskId(testTask._id.toString());

      expect(comments[0]).toHaveProperty('author');
    });
  });
});
