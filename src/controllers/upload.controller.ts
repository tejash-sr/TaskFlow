import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { asyncHandler } from '@/utils/asyncHandler';
import { AppError } from '@/utils/AppError';
import Task from '@/models/Task.model';
import { generateTaskReportPdf, generateTaskReportCsv } from '@/utils/pdfReporter';
import { ITask } from '@/types/models.types';

export const uploadAttachment = asyncHandler(async (req: Request, res: Response) => {
  const task = await Task.findById(req.params.id);
  if (!task) throw new AppError('Task not found', 404);

  if (!req.file) throw new AppError('No file uploaded', 400);

  task.attachments.push({
    filename: req.file.originalname,
    path: req.file.path,
    size: req.file.size,
  });

  await task.save();

  res.status(200).json({
    status: 'success',
    data: { attachments: task.attachments },
  });
});

export const downloadAttachment = asyncHandler(async (req: Request, res: Response) => {
  const task = await Task.findById(req.params.id);
  if (!task) throw new AppError('Task not found', 404);

  const attachment = task.attachments.find(
    (a) => path.basename(a.path) === req.params.filename,
  );

  if (!attachment) throw new AppError('Attachment not found', 404);

  if (!fs.existsSync(attachment.path)) {
    throw new AppError('File no longer exists on disk', 410);
  }

  res.download(attachment.path, attachment.filename);
});

export const exportTasksPdf = asyncHandler(async (req: Request, res: Response) => {
  const { status, priority } = req.query as Record<string, string>;

  const query: Record<string, unknown> = { deletedAt: { $exists: false } };
  if (status) query.status = status;
  if (priority) query.priority = priority;

  const tasks = await Task.find(query)
    .populate('assignee', 'name email')
    .populate('project', 'name')
    .limit(500);

  await generateTaskReportPdf(
    { title: 'Task Report', tasks: tasks as unknown as ITask[] },
    res,
  );
});

export const exportTasksCsv = asyncHandler(async (req: Request, res: Response) => {
  const { status, priority } = req.query as Record<string, string>;

  const query: Record<string, unknown> = { deletedAt: { $exists: false } };
  if (status) query.status = status;
  if (priority) query.priority = priority;

  const tasks = await Task.find(query).limit(500);

  const csv = await generateTaskReportCsv(tasks as unknown as ITask[]);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="tasks-${Date.now()}.csv"`,
  );
  res.status(200).send(csv);
});
