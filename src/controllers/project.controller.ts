import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import projectService from '@/services/project.service';
import { generateTaskReportPdf, generateTaskReportCsv } from '@/utils/pdfReporter';
import { ITask } from '@/types/models.types';
import Project from '@/models/Project.model';
import Task from '@/models/Task.model';
import { AppError } from '@/utils/AppError';

export const createProject = asyncHandler(async (req: Request, res: Response) => {
  const project = await projectService.create(req.body, req.userId!);
  res.status(201).json({ status: 'success', data: project });
});

export const getProjectTasks = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = req.query as Record<string, string>;

  const result = await projectService.getProjectTasks(
    req.params.id,
    page ? parseInt(page, 10) : 1,
    limit ? parseInt(limit, 10) : 20,
  );

  res.status(200).json({ status: 'success', ...result });
});

export const getProjectReport = asyncHandler(async (req: Request, res: Response) => {
  const project = await Project.findById(req.params.id)
    .populate('owner', 'name email')
    .populate('members', 'name email');

  if (!project) throw new AppError('Project not found', 404);

  const tasks = await Task.find({
    project: project._id,
    deletedAt: { $exists: false },
  })
    .populate('assignee', 'name email')
    .limit(500);

  await generateTaskReportPdf(
    {
      title: `Project Report — ${project.name}`,
      tasks: tasks as unknown as ITask[],
      generatedBy: 'TaskFlow API',
    },
    res,
  );
});

export const exportProjectCsv = asyncHandler(async (req: Request, res: Response) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw new AppError('Project not found', 404);

  const tasks = await Task.find({
    project: project._id,
    deletedAt: { $exists: false },
  }).limit(500);

  const csv = await generateTaskReportCsv(tasks as unknown as ITask[]);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${project.name.replace(/\s+/g, '-')}-tasks-${Date.now()}.csv"`,
  );
  res.status(200).send(csv);
});
