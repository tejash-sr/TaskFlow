import { Schema, model, Model } from 'mongoose';
import { IProject, ProjectStatus } from '@/types/models.types';

interface IProjectModel extends Model<IProject> {}

const projectSchema = new Schema<IProject, IProjectModel>(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name must not exceed 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: [1000, 'Description must not exceed 1000 characters'],
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner is required'],
    },
    members: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
    status: {
      type: String,
      enum: ['active', 'archived', 'completed'] as ProjectStatus[],
      default: 'active',
    },
  },
  { timestamps: true },
);

// Indexes for common query patterns
projectSchema.index({ owner: 1 });
projectSchema.index({ members: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ createdAt: -1 });

const Project = model<IProject, IProjectModel>('Project', projectSchema);

export default Project;
