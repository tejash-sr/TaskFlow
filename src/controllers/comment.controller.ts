import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import commentService from '@/services/comment.service';

export const addComment = asyncHandler(async (req: Request, res: Response) => {
  const comment = await commentService.create(req.params.id, req.userId!, req.body);
  res.status(201).json({ status: 'success', data: comment });
});

export const listComments = asyncHandler(async (req: Request, res: Response) => {
  const comments = await commentService.findByTask(req.params.id);
  res.status(200).json({ status: 'success', data: comments });
});

export const deleteComment = asyncHandler(async (req: Request, res: Response) => {
  await commentService.deleteComment(req.params.commentId, req.userId!);
  res.status(200).json({ status: 'success', message: 'Comment deleted successfully' });
});
