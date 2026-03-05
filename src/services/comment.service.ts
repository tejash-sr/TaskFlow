import Comment from '@/models/Comment.model';
import Task from '@/models/Task.model';
import { AppError } from '@/utils/AppError';
import { IComment } from '@/types/models.types';

interface CreateCommentDTO {
  content: string;
  parent?: string;
}

interface ThreadedComment extends Omit<IComment, 'parent'> {
  replies: ThreadedComment[];
}

export class CommentService {
  async create(taskId: string, authorId: string, data: CreateCommentDTO): Promise<IComment> {
    const task = await Task.findOne({ _id: taskId, deletedAt: { $exists: false } });
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    const comment = await Comment.create({
      content: data.content,
      author: authorId,
      task: taskId,
      ...(data.parent && { parent: data.parent }),
    });

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
