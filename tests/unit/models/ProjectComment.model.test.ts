import { Types } from 'mongoose';
import Project from '@/models/Project.model';
import Comment from '@/models/Comment.model';
import User from '@/models/User.model';
import Task from '@/models/Task.model';

describe('Project model', () => {
  it('saves a project with valid data', async () => {
    const user = await new User({
      email: 'owner@example.com',
      password: 'password123',
      name: 'Owner',
    }).save();

    const project = await new Project({
      name: 'My Project',
      description: 'A test project',
      owner: user._id,
      members: [user._id],
    }).save();

    expect(project._id).toBeDefined();
    expect(project.status).toBe('active');
    expect(project.owner.toString()).toBe(user._id.toString());
  });

  it('fails when name is missing', async () => {
    const user = await new User({
      email: 'owner2@example.com',
      password: 'password123',
      name: 'Owner2',
    }).save();

    const project = new Project({ description: 'desc', owner: user._id });
    await expect(project.save()).rejects.toThrow();
  });

  it('stores member refs as ObjectIds', async () => {
    const user = await new User({
      email: 'member@example.com',
      password: 'password123',
      name: 'Member',
    }).save();

    const project = await new Project({
      name: 'Ref Project',
      description: 'desc',
      owner: user._id,
      members: [user._id],
    }).save();

    expect(project.members[0]).toBeInstanceOf(Types.ObjectId);
  });
});

describe('Comment model', () => {
  async function setup() {
    const user = await new User({
      email: `c${Date.now()}@example.com`,
      password: 'password123',
      name: 'Commenter',
    }).save();
    const project = await new Project({
      name: 'Comment Project',
      description: 'desc',
      owner: user._id,
    }).save();
    const task = await new Task({
      title: 'Comment Task',
      description: 'desc',
      assignee: user._id,
      project: project._id,
    }).save();
    return { user, task };
  }

  it('saves a comment with valid data', async () => {
    const { user, task } = await setup();
    const comment = await new Comment({
      content: 'A great comment',
      author: user._id,
      task: task._id,
    }).save();

    expect(comment._id).toBeDefined();
    expect(comment.author.toString()).toBe(user._id.toString());
  });

  it('fails when content is missing', async () => {
    const { user, task } = await setup();
    const comment = new Comment({ author: user._id, task: task._id });
    await expect(comment.save()).rejects.toThrow();
  });

  it('supports threaded replies via parent ref', async () => {
    const { user, task } = await setup();
    const parent = await new Comment({
      content: 'Parent comment',
      author: user._id,
      task: task._id,
    }).save();

    const reply = await new Comment({
      content: 'Reply comment',
      author: user._id,
      task: task._id,
      parent: parent._id,
    }).save();

    expect(reply.parent!.toString()).toBe(parent._id.toString());
  });

  it('stores author and task as ObjectIds', async () => {
    const { user, task } = await setup();
    const comment = await new Comment({
      content: 'Ref test',
      author: user._id,
      task: task._id,
    }).save();

    expect(comment.author).toBeInstanceOf(Types.ObjectId);
    expect(comment.task).toBeInstanceOf(Types.ObjectId);
  });
});
