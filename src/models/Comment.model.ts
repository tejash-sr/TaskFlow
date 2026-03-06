import { Schema, model, Model } from 'mongoose';
import { IComment } from '@/types/models.types';

interface ICommentModel extends Model<IComment> {}

const commentSchema = new Schema<IComment, ICommentModel>(
  {
    content: {
      type: String,
      required: [true, 'Content is required'],
      trim: true,
      minlength: [1, 'Comment cannot be empty'],
      maxlength: [2000, 'Content must not exceed 2000 characters'],
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author is required'],
    },
    task: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      required: [true, 'Task is required'],
    },
    parent: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
    },
  },
  { timestamps: true },
);

const Comment = model<IComment, ICommentModel>('Comment', commentSchema);

export default Comment;
