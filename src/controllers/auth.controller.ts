import { Request, Response } from 'express';
import path from 'path';
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

  // Ensure avatars subdirectory exists
  const avatarsDir = path.join(process.cwd(), 'uploads', 'avatars');
  if (!fs.existsSync(avatarsDir)) {
    fs.mkdirSync(avatarsDir, { recursive: true });
  }

  let avatarRelPath: string;

  try {
    // Dynamically import sharp so tests without it still work
    const sharp = (await import('sharp')).default;
    const processedFilename = `avatar-${req.userId}-${Date.now()}.jpg`;
    const processedPath = path.join(avatarsDir, processedFilename);

    await sharp(req.file.path)
      .resize(200, 200, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 90 })
      .toFile(processedPath);

    // Delete original uploaded file
    try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }

    avatarRelPath = `uploads/avatars/${processedFilename}`;
  } catch {
    // Fallback: use file as-is if sharp fails
    avatarRelPath = req.file.path.replace(/\\/g, '/').replace(/^.*uploads\//, 'uploads/');
  }

  // Delete old avatar if exists
  if (user.avatar) {
    const oldPath = path.join(process.cwd(), user.avatar);
    try { fs.unlinkSync(oldPath); } catch { /* ignore */ }
  }

  user.avatar = avatarRelPath;
  await user.save({ validateBeforeSave: false });

  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
  res.status(200).json({
    status: 'success',
    data: {
      avatar: user.avatar,
      avatarUrl: `${baseUrl}/${user.avatar}`,
    },
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

  const avatarPath = path.join(process.cwd(), user.avatar);
  try { fs.unlinkSync(avatarPath); } catch { /* ignore if file missing */ }

  user.avatar = undefined;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: 'success',
    message: 'Avatar deleted successfully',
  });
});
