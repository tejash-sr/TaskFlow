import { GraphQLScalarType, Kind } from 'graphql';
import Task from '@/models/Task.model';
import Project from '@/models/Project.model';
import User from '@/models/User.model';
import taskService from '@/services/task.service';
import projectService from '@/services/project.service';
import authService from '@/services/auth.service';
import { AppError } from '@/utils/AppError';

const DateScalar = new GraphQLScalarType({
  name: 'Date',
  description: 'ISO-8601 date scalar',
  serialize(value: unknown) {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string' || typeof value === 'number') return new Date(value).toISOString();
    return null;
  },
  parseValue(value: unknown) {
    if (typeof value === 'string' || typeof value === 'number') return new Date(value);
    return null;
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) return new Date(ast.value);
    return null;
  },
});

interface GqlContext {
  userId?: string;
  userRole?: string;
}

function requireAuth(ctx: GqlContext): string {
  if (!ctx.userId) throw new AppError('Authentication required', 401);
  return ctx.userId;
}

export const resolvers = {
  Date: DateScalar,

  Query: {
    tasks: async (_: unknown, args: { page?: number; limit?: number; status?: string; priority?: string }, ctx: GqlContext) => {
      requireAuth(ctx);
      return taskService.findAll({
        page: args.page ?? 1,
        limit: args.limit ?? 20,
        status: args.status,
        priority: args.priority,
      });
    },

    task: async (_: unknown, args: { id: string }, ctx: GqlContext) => {
      requireAuth(ctx);
      return taskService.findById(args.id);
    },

    projects: async (_: unknown, __: unknown, ctx: GqlContext) => {
      requireAuth(ctx);
      return Project.find().populate('owner', 'name email').populate('members', 'name email');
    },

    project: async (_: unknown, args: { id: string }, ctx: GqlContext) => {
      requireAuth(ctx);
      return Project.findById(args.id).populate('owner', 'name email').populate('members', 'name email');
    },

    me: async (_: unknown, __: unknown, ctx: GqlContext) => {
      requireAuth(ctx);
      return User.findById(ctx.userId);
    },
  },

  Mutation: {
    createTask: async (_: unknown, args: {
      title: string;
      description: string;
      project: string;
      assignee: string;
      status?: string;
      priority?: string;
      dueDate?: string;
    }, ctx: GqlContext) => {
      const userId = requireAuth(ctx);
      return taskService.create(args, userId);
    },

    updateTask: async (_: unknown, args: { id: string; [key: string]: unknown }, ctx: GqlContext) => {
      requireAuth(ctx);
      const { id, ...updates } = args;
      return taskService.update(id, updates);
    },

    deleteTask: async (_: unknown, args: { id: string }, ctx: GqlContext) => {
      requireAuth(ctx);
      await taskService.softDelete(args.id);
      return true;
    },

    createProject: async (_: unknown, args: { name: string; description?: string }, ctx: GqlContext) => {
      const userId = requireAuth(ctx);
      return projectService.create({ name: args.name, description: args.description ?? '', members: [userId] }, userId);
    },

    signup: async (_: unknown, args: { name: string; email: string; password: string }) => {
      const { user, tokens } = await authService.signup(args);
      return { ...tokens, user };
    },

    login: async (_: unknown, args: { email: string; password: string }) => {
      const { user, tokens } = await authService.login(args);
      return { ...tokens, user };
    },
  },

  Task: {
    id: (parent: { _id: unknown }) => String(parent._id),
  },
  Project: {
    id: (parent: { _id: unknown }) => String(parent._id),
  },
  User: {
    id: (parent: { _id: unknown }) => String(parent._id),
  },
};
