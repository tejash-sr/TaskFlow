import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import authService from '@/services/auth.service';
import User from '@/models/User.model';
import { AppError } from '@/utils/AppError';

export const signup = asyncHandler(async (req: Request, res: Response) => {
  const { user, tokens } = await authService.signup(req.body);
  res.status(201).json({
    status: 'success',
    data: { user, ...tokens },
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { user, tokens } = await authService.login(req.body);
  res.status(200).json({
    status: 'success',
    data: { user, ...tokens },
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken: string };
  const tokens = await authService.refresh(refreshToken);
  res.status(200).json({
    status: 'success',
    data: tokens,
  });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };
  const token = await authService.forgotPassword(email);
  res.status(200).json({
    status: 'success',
    message: 'If this email is registered, you will receive a reset link',
    ...(process.env.NODE_ENV !== 'production' && { resetToken: token }),
  });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body as { token: string; password: string };
  await authService.resetPassword(token, password);
  res.status(200).json({
    status: 'success',
    message: 'Password reset successfully',
  });
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.userId);
  if (!user) throw new AppError('User not found', 404);
  res.status(200).json({
    status: 'success',
    data: { user },
  });
});

export const uploadAvatar = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new AppError('No file uploaded', 400);

  const user = await User.findByIdAndUpdate(
    req.userId,
    { avatar: req.file.path },
    { new: true },
  );

  if (!user) throw new AppError('User not found', 404);

  res.status(200).json({
    status: 'success',
    data: { avatar: user.avatar },
  });
});
