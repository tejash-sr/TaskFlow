import { Request, Response } from 'express';
import fs from 'fs';
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

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.query as { token: string };
  if (!token) throw new AppError('Verification token is required', 400);
  await authService.verifyEmail(token);
  res.status(200).json({
    status: 'success',
    message: 'Email verified successfully',
  });
});

export const resendVerification = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };
  await authService.resendVerification(email);
  res.status(200).json({
    status: 'success',
    message: 'If your email is registered and unverified, a new verification link has been sent',
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

// MISSING-01: PUT /api/auth/me — update name/email via REST API
export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const { name, email } = req.body as { name?: string; email?: string };

  const updates: Record<string, string> = {};
  if (name && name.trim().length >= 2) updates['name'] = name.trim();
  if (email) {
    const emailLower = email.toLowerCase().trim();
    const existing = await User.findOne({ email: emailLower, _id: { $ne: req.userId } });
    if (existing) throw new AppError('Email already taken', 409);
    updates['email'] = emailLower;
  }

  const user = await User.findByIdAndUpdate(
    req.userId,
    { $set: updates },
    { new: true, runValidators: true },
  );
  if (!user) throw new AppError('User not found', 404);

  res.status(200).json({
    status: 'success',
    data: { user },
  });
});

export const uploadAvatar = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new AppError('No file uploaded', 400);

  const user = await User.findById(req.userId);
  if (!user) throw new AppError('User not found', 404);

  let imageBuffer: Buffer;
  try {
    const sharp = (await import('sharp')).default;
    imageBuffer = await sharp(req.file.buffer || req.file.path)
      .resize(200, 200, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    imageBuffer = req.file.buffer || fs.readFileSync(req.file.path);
  }

  // Clean up temp file if it was saved to disk
  if (req.file.path) {
    try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
  }

  // Store avatar as base64 data URI in MongoDB (survives Render restarts)
  const base64 = imageBuffer.toString('base64');
  const mimeType = 'image/jpeg';
  user.avatar = `data:${mimeType};base64,${base64}`;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: 'success',
    data: { avatar: user.avatar, avatarUrl: user.avatar },
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const { blacklistToken } = await import('@/utils/tokenBlacklist');
    const { verifyAccessToken } = await import('@/utils/tokenUtils');
    const token = authHeader.split(' ')[1];
    try {
      const payload = verifyAccessToken(token) as { exp?: number };
      const ttl = Math.max(0, (payload.exp ?? 0) - Math.floor(Date.now() / 1000));
      await blacklistToken(token, ttl);
    } catch { /* already expired — no need to blacklist */ }
  }
  res.status(200).json({ status: 'success', message: 'Logged out successfully' });
});

export const deleteAvatar = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.userId);
  if (!user) throw new AppError('User not found', 404);

  if (!user.avatar) throw new AppError('No avatar to delete', 400);

  user.avatar = undefined;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: 'success',
    message: 'Avatar deleted successfully',
  });
});
