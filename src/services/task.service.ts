import { Types } from 'mongoose';
import Task from '@/models/Task.model';
import Project from '@/models/Project.model';
import { AppError } from '@/utils/AppError';
import { ITask, PaginatedResult, CursorPaginatedResult } from '@/types/models.types';
import { enqueueEmail } from '@/queues/emailQueue';
import { emitToProject } from '@/socket';

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
  assignee?: string;
}

interface TaskFilters {
  status?: string;
  priority?: string;
  assignee?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
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

    // Emit socket event for real-time updates
    emitToProject(data.project, { event: 'task:created', payload: { task } });

    // Send task assignment email if the assignee is different from the creator
    if (data.assignee && data.assignee !== requestingUserId) {
      const User = (await import('@/models/User.model')).default;
      const assignee = await User.findById(data.assignee).select('name email');
      if (assignee) {
        void enqueueEmail({
          type: 'taskAssigned',
          to: assignee.email,
          assigneeName: assignee.name,
          taskTitle: task.title,
          taskId: (task._id as object).toString(),
          projectName: project.name,
        }).catch(() => {});
      }
    }

    return task;
  }

  async findAll(filters: TaskFilters): Promise<PaginatedResult<ITask>> {
    const { page = 1, limit = 20, status, priority, assignee, search, sortBy = 'createdAt', sortOrder = 'desc' } = filters;
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

    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sortField = sortBy === 'createdAt' ? 'createdAt' : sortBy;

    const [data, total] = await Promise.all([
      Task.find(query)
        .sort({ [sortField]: sortDirection })
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
    const task = await Task.findOne({ _id: id, deletedAt: { $exists: false } });

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Validate dueDate is not in the past when explicitly changing it
    if (data.dueDate) {
      const newDueDate = new Date(data.dueDate);
      if (newDueDate <= new Date()) {
        throw new AppError('Due date must be a future date', 400);
      }
    }

    const previousAssignee = task.assignee?.toString();

    // Apply updates — using Object.assign ensures pre-save hook fires on save()
    Object.assign(task, data);

    // runValidators ensures schema validators run on update fields
    await task.save({ validateModifiedOnly: true });

    // Emit socket events for real-time updates
    emitToProject(task.project.toString(), { event: 'task:updated', payload: { task } });
    if (data.status) {
      emitToProject(task.project.toString(), {
        event: 'task:status-changed',
        payload: { taskId: (task._id as object).toString(), oldStatus: task.status, newStatus: data.status },
      });
    }

    // Send assignment email if assignee changed
    if (data.assignee && data.assignee !== previousAssignee) {
      const User = (await import('@/models/User.model')).default;
      const [assignee, project] = await Promise.all([
        User.findById(data.assignee).select('name email'),
        import('@/models/Project.model').then((m) => m.default.findById(task.project).select('name')),
      ]);
      if (assignee) {
        void enqueueEmail({
          type: 'taskAssigned',
          to: assignee.email,
          assigneeName: assignee.name,
          taskTitle: task.title,
          taskId: (task._id as object).toString(),
          projectName: project?.name ?? 'Unknown Project',
        }).catch(() => {});
      }
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
