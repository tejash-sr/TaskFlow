import Comment from '@/models/Comment.model';
import Task from '@/models/Task.model';
import User from '@/models/User.model';
import Project from '@/models/Project.model';
import { AppError } from '@/utils/AppError';
import { IComment } from '@/types/models.types';
import { enqueueEmail } from '@/queues/emailQueue';

interface CreateCommentDTO {
  content: string;
  parent?: string;
}

export class CommentService {
  async create(taskId: string, authorId: string, data: CreateCommentDTO): Promise<IComment> {
    const task = await Task.findOne({ _id: taskId, deletedAt: { $exists: false } })
      .populate<{ assignee: { _id: { toString(): string }; name: string; email: string } | null }>('assignee', 'name email')
      .populate<{ project: { name: string } | null }>('project', 'name');
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    const comment = await Comment.create({
      content: data.content,
      author: authorId,
      task: taskId,
      ...(data.parent && { parent: data.parent }),
    });

    // Send notification email to task assignee (if different from commenter)
    const assignee = task.assignee as { _id: { toString(): string }; name: string; email: string } | null;
    if (assignee && assignee._id.toString() !== authorId) {
      const commenter = await User.findById(authorId).select('name').lean();
      const project = task.project as { name: string } | null;
      void enqueueEmail({
        type: 'commentAdded',
        to: assignee.email,
        assigneeName: assignee.name,
        commenterName: (commenter as { name?: string } | null)?.name ?? 'Someone',
        taskTitle: task.title,
        projectName: project?.name ?? 'Unknown Project',
      }).catch(() => {});
    }

    return comment.populate('author', 'name email avatar');
  }

  async deleteComment(commentId: string, requesterId: string): Promise<void> {
    const comment = await Comment.findById(commentId);
    if (!comment) throw new AppError('Comment not found', 404);
    if (comment.author.toString() !== requesterId)
      throw new AppError('You can only delete your own comments', 403);
    await Comment.findByIdAndDelete(commentId);
  }

  async findByTask(taskId: string): Promise<IComment[]> {
    const task = await Task.findOne({ _id: taskId, deletedAt: { $exists: false } });
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    const comments = await Comment.find({ task: taskId })
      .populate('author', 'name email avatar')
      .sort({ createdAt: 1 });

    return comments;
  }
}

export default new CommentService();
