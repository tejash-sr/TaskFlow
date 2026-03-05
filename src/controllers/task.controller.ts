import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import taskService from '@/services/task.service';

export const createTask = asyncHandler(async (req: Request, res: Response) => {
  const task = await taskService.create(req.body, req.userId!);
  res.status(201).json({ status: 'success', data: task });
});

export const listTasks = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, status, priority, assignee } = req.query as Record<string, string>;

  const result = await taskService.findAll({
    page: page ? parseInt(page, 10) : 1,
    limit: limit ? parseInt(limit, 10) : 20,
    status,
    priority,
    assignee,
  });

  res.status(200).json({ status: 'success', ...result });
});

export const listTasksCursor = asyncHandler(async (req: Request, res: Response) => {
  const { cursor, limit, status, priority, sortBy, sortOrder } = req.query as Record<string, string>;

  const result = await taskService.findAllCursor(
    cursor,
    limit ? parseInt(limit, 10) : 20,
    { status, priority, sortBy, sortOrder: sortOrder as 'asc' | 'desc' | undefined },
  );

  res.status(200).json({ status: 'success', ...result });
});

export const getTask = asyncHandler(async (req: Request, res: Response) => {
  const task = await taskService.findById(req.params.id);
  res.status(200).json({ status: 'success', data: task });
});

export const updateTask = asyncHandler(async (req: Request, res: Response) => {
  const task = await taskService.update(req.params.id, req.body);
  res.status(200).json({ status: 'success', data: task });
});

export const deleteTask = asyncHandler(async (req: Request, res: Response) => {
  const task = await taskService.softDelete(req.params.id);
  res.status(200).json({ status: 'success', data: task });
});
