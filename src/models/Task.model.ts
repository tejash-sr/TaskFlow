import { Schema, model, Model, Types } from 'mongoose';
import { ITask, TaskStatus, TaskPriority, IAttachment, StatusCounts } from '@/types/models.types';

const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 30;

interface ITaskModel extends Model<ITask> {
  findByProject(
    projectId: Types.ObjectId | string,
    page?: number,
    limit?: number,
  ): Promise<ITask[]>;
  findOverdue(): Promise<ITask[]>;
  getStatusCounts(projectId: Types.ObjectId | string): Promise<StatusCounts>;
}

const attachmentSchema = new Schema<IAttachment>(
  {
    filename: { type: String, required: true },
    path: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { _id: true },
);

const taskSchema = new Schema<ITask, ITaskModel>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [100, 'Title must not exceed 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: [2000, 'Description must not exceed 2000 characters'],
    },
    status: {
      type: String,
      enum: ['todo', 'in-progress', 'review', 'done'] as TaskStatus[],
      default: 'todo',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'] as TaskPriority[],
      default: 'medium',
    },
    assignee: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assignee is required'],
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project is required'],
    },
    tags: {
      type: [String],
      default: [],
      validate: [
        {
          validator: (tags: string[]) => tags.length <= MAX_TAGS,
          message: `Tags must not exceed ${MAX_TAGS} items`,
        },
        {
          validator: (tags: string[]) => tags.every((t) => t.length <= MAX_TAG_LENGTH),
          message: `Each tag must not exceed ${MAX_TAG_LENGTH} characters`,
        },
      ],
    },
    dueDate: {
      type: Date,
      validate: {
        validator: function (this: ITask, value: Date) {
          if (!value) return true;
          if (!this.isNew) return true;
          return value > new Date();
        },
        message: 'Due date must be a future date',
      },
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    completedAt: {
      type: Date,
    },
    deletedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

taskSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    if (this.status === 'done' && !this.completedAt) {
      this.completedAt = new Date();
    } else if (this.status !== 'done' && this.completedAt) {
      this.completedAt = undefined; // Clear if moved back from done
    }
  }
  next();
});

taskSchema.statics.findByProject = async function (
  projectId: Types.ObjectId | string,
  page = 1,
  limit = 20,
): Promise<ITask[]> {
  const skip = (page - 1) * limit;
  return this.find({ project: projectId, deletedAt: { $exists: false } })
    .skip(skip)
    .limit(limit);
};

taskSchema.statics.findOverdue = async function (): Promise<ITask[]> {
  return this.find({
    dueDate: { $lt: new Date() },
    status: { $ne: 'done' },
    deletedAt: { $exists: false },
  });
};

taskSchema.statics.getStatusCounts = async function (
  projectId: Types.ObjectId | string,
): Promise<StatusCounts> {
  const results = await this.aggregate([
    { $match: { project: new Types.ObjectId(projectId.toString()), deletedAt: { $exists: false } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const counts: StatusCounts = { todo: 0, 'in-progress': 0, review: 0, done: 0 };
  for (const r of results) {
    counts[r._id as keyof StatusCounts] = r.count;
  }
  return counts;
};

// ── Compound indexes for common query patterns ──────────────────────────────
taskSchema.index({ project: 1, status: 1, priority: -1 });
taskSchema.index({ assignee: 1, dueDate: 1, status: 1 });
taskSchema.index({ status: 1, createdAt: -1 });
taskSchema.index({ tags: 1 });
taskSchema.index({ title: 'text', description: 'text' });
taskSchema.index(
  { dueDate: 1 },
  {
    partialFilterExpression: {
      status: { $in: ['todo', 'in-progress'] },
      dueDate: { $exists: true },
    },
  },
);

// ── Virtual fields ────────────────────────────────────────────────────────────
taskSchema.virtual('isOverdue').get(function (this: ITask) {
  if (!this.dueDate || this.status === 'done') return false;
  return new Date(this.dueDate) < new Date();
});

taskSchema.virtual('daysUntilDue').get(function (this: ITask) {
  if (!this.dueDate) return null;
  const diff = new Date(this.dueDate).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

taskSchema.set('toJSON', { virtuals: true });
taskSchema.set('toObject', { virtuals: true });

const Task = model<ITask, ITaskModel>('Task', taskSchema);

export default Task;
