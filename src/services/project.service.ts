import { Types } from 'mongoose';
import Project from '@/models/Project.model';
import Task from '@/models/Task.model';
import { AppError } from '@/utils/AppError';
import { IProject, ITask, PaginatedResult } from '@/types/models.types';
import { enqueueEmail } from '@/queues/emailQueue';

interface CreateProjectDTO {
  name: string;
  description: string;
  members?: string[];
}

export class ProjectService {
  async findAll(): Promise<(IProject & { taskCount: number })[]> {
    const projects = await Project.find()
      .populate('owner', 'name email')
      .populate('members', 'name email')
      .sort({ createdAt: -1 });

    const projectIds = projects.map((p) => p._id);
    const counts = await Task.aggregate([
      { $match: { project: { $in: projectIds }, deletedAt: { $exists: false } } },
      { $group: { _id: '$project', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c: { _id: unknown; count: number }) => [String(c._id), c.count]));

    return projects.map((p) => {
      const plain = p.toObject() as unknown as IProject & { taskCount: number };
      plain.taskCount = countMap.get(String(p._id)) ?? 0;
      return plain;
    });
  }

  async create(data: CreateProjectDTO, ownerId: string): Promise<IProject> {
    const memberIds = Array.from(
      new Set([ownerId, ...(data.members || [])]),
    ).map((id) => new Types.ObjectId(id));

    const project = await Project.create({
      ...data,
      owner: new Types.ObjectId(ownerId),
      members: memberIds,
    });

    return project;
  }

  async findById(id: string): Promise<IProject> {
    const project = await Project.findById(id)
      .populate('owner', 'name email')
      .populate('members', 'name email');

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    return project;
  }

  async addMember(projectId: string, email: string, requesterId?: string): Promise<IProject> {
    const User = (await import('@/models/User.model')).default;
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) throw new AppError('No user found with that email address', 404);

    const project = await Project.findById(projectId);
    if (!project) throw new AppError('Project not found', 404);

    const alreadyMember = project.members.some(
      (m) => m.toString() === (user._id as Types.ObjectId).toString(),
    );
    if (alreadyMember) throw new AppError('User is already a member of this project', 409);

    project.members.push(user._id as Types.ObjectId);
    await project.save();

    // Send email notification to the newly added member
    let ownerName = 'Project Owner';
    if (requesterId) {
      const owner = await User.findById(requesterId).select('name');
      if (owner) ownerName = owner.name;
    }
    void enqueueEmail({
      type: 'projectMemberAdded',
      to: user.email,
      memberName: user.name,
      projectName: project.name,
      ownerName,
    }).catch(() => {});

    return project.populate('members', 'name email');
  }

  async removeMember(projectId: string, memberId: string, requesterId: string): Promise<IProject> {
    const project = await Project.findById(projectId);
    if (!project) throw new AppError('Project not found', 404);
    if (project.owner.toString() !== requesterId)
      throw new AppError('Only the project owner can remove members', 403);
    project.members = project.members.filter((m) => m.toString() !== memberId) as Types.ObjectId[];
    await project.save();
    return project.populate('members', 'name email');
  }

  async deleteProject(id: string, requesterId: string): Promise<void> {
    const project = await Project.findById(id);
    if (!project) throw new AppError('Project not found', 404);
    if (project.owner.toString() !== requesterId)
      throw new AppError('Only the project owner can delete this project', 403);
    await Task.updateMany(
      { project: project._id, deletedAt: { $exists: false } },
      { $set: { deletedAt: new Date() } },
    );
    await Project.findByIdAndDelete(id);
  }

  async getProjectTasks(projectId: string, page = 1, limit = 20): Promise<PaginatedResult<ITask>> {
    const project = await Project.findById(projectId);
    if (!project) {
      throw new AppError('Project not found', 404);
    }

    const skip = (page - 1) * limit;
    const query = { project: new Types.ObjectId(projectId), deletedAt: { $exists: false } };

    const [data, total] = await Promise.all([
      Task.find(query)
        .skip(skip)
        .limit(limit)
        .populate('assignee', 'name email'),
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
}

export default new ProjectService();
