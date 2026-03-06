import { Types } from 'mongoose';
import Task from '@/models/Task.model';
import Project from '@/models/Project.model';
import { AppError } from '@/utils/AppError';
import { ITask, PaginatedResult, CursorPaginatedResult } from '@/types/models.types';

interface CreateTaskDTO {
  title: string;
  description: string;
  status?: string;
  priority?: string;
  assignee: string;
  project: string;
  tags?: string[];
  dueDate?: string;
}

interface UpdateTaskDTO {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  tags?: string[];
  dueDate?: string;
}

interface TaskFilters {
  status?: string;
  priority?: string;
  assignee?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class TaskService {
  async create(data: CreateTaskDTO, requestingUserId: string): Promise<ITask> {
    const project = await Project.findById(data.project);
    if (!project) {
      throw new AppError('Project not found', 404);
    }

    const isMember = project.members.some(
      (m) => m.toString() === requestingUserId,
    ) || project.owner.toString() === requestingUserId;

    if (!isMember) {
      throw new AppError('You are not a member of this project', 403);
    }

    const task = await Task.create(data);
    return task;
  }

  async findAll(filters: TaskFilters): Promise<PaginatedResult<ITask>> {
    const { page = 1, limit = 20, status, priority, assignee, search } = filters;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assignee) query.assignee = new Types.ObjectId(assignee);
    if (search && search.trim()) {
      query.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      Task.find(query)
        .skip(skip)
        .limit(limit)
        .populate('assignee', 'name email')
        .populate('project', 'name'),
      Task.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    };
  }

  async findById(id: string): Promise<ITask> {
    const task = await Task.findOne({ _id: id, deletedAt: { $exists: false } })
      .populate('assignee', 'name email avatar')
      .populate('project', 'name description');

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    return task;
  }

  async update(id: string, data: UpdateTaskDTO): Promise<ITask> {
    const task = await Task.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false } },
      { $set: data },
      { new: true, runValidators: true },
    );

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    return task;
  }

  async softDelete(id: string): Promise<ITask> {
    const task = await Task.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false } },
      { $set: { deletedAt: new Date() } },
      { new: true },
    );

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    return task;
  }

  async findAllCursor(
    cursor: string | undefined,
    limit = 20,
    filters: { status?: string; priority?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' } = {},
  ): Promise<CursorPaginatedResult<ITask>> {
    const safeLimit = Math.max(1, limit);
    const { status, priority, sortBy = 'createdAt', sortOrder = 'desc' } = filters;

    const query: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (status) query.status = status;
    if (priority) query.priority = priority;

    if (cursor) {
      const sortDir = sortOrder === 'asc' ? '$gt' : '$lt';
      query[sortBy === '_id' || sortBy === 'createdAt' ? '_id' : sortBy] = {
        [sortDir]: sortBy === 'createdAt' ? new Types.ObjectId(cursor) : cursor,
      };
    }

    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const items = await Task.find(query)
      .sort({ [sortBy === 'createdAt' ? '_id' : sortBy]: sortDirection })
      .limit(safeLimit + 1)
      .populate('assignee', 'name email')
      .populate('project', 'name');

    const hasMore = items.length > safeLimit;
    const data = hasMore ? items.slice(0, safeLimit) : items;
    const lastItem = data[data.length - 1];
    const nextCursor =
      hasMore && lastItem
        ? (sortBy === 'createdAt' ? lastItem._id.toString() : String((lastItem as unknown as Record<string, unknown>)[sortBy]))
        : null;

    return { data, nextCursor, hasMore, limit: safeLimit };
  }
}

export default new TaskService();
