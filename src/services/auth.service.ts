import crypto from 'crypto';
import User from '@/models/User.model';
import { IUser } from '@/types/models.types';
import { AppError } from '@/utils/AppError';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@/utils/tokenUtils';
import { enqueueEmail } from '@/queues/emailQueue';
import { env } from '@/config/env';

export interface SignupDto {
  name: string;
  email: string;
  password: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

class AuthService {
  async signup(dto: SignupDto): Promise<{ user: IUser; tokens: AuthTokens }> {
    const existing = await User.findOne({ email: dto.email.toLowerCase() });
    if (existing) {
      throw new AppError('Email already in use', 409);
    }

    const user = await User.create({
      name: dto.name,
      email: dto.email.toLowerCase(),
      password: dto.password,
    });

    const rawToken = user.generateEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    const tokens = this.generateTokens(user);

    const verifyUrl = `${process.env.CLIENT_URL ?? `http://localhost:${env.port}`}/verify-email?token=${rawToken}`;
    void enqueueEmail({ type: 'welcome', to: user.email, name: user.name }).catch(() => {});
    void enqueueEmail({ type: 'verifyEmail', to: user.email, name: user.name, verifyUrl }).catch(() => {});

    return { user, tokens };
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashed,
      emailVerificationExpires: { $gt: Date.now() },
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user) {
      throw new AppError('Invalid or expired verification token', 400);
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });
  }

  async resendVerification(email: string): Promise<void> {
    const user = await User.findOne({ email: email.toLowerCase() }).select('+emailVerificationToken +emailVerificationExpires');
    if (!user) return; // silent — no email harvesting
    if (user.emailVerified) return; // already verified

    const rawToken = user.generateEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    const verifyUrl = `${process.env.CLIENT_URL ?? `http://localhost:${env.port}`}/verify-email?token=${rawToken}`;
    void enqueueEmail({ type: 'verifyEmail', to: user.email, name: user.name, verifyUrl }).catch(() => {});
  }

  async login(dto: LoginDto): Promise<{ user: IUser; tokens: AuthTokens }> {
    const user = await User.findOne({ email: dto.email.toLowerCase() }).select('+password');
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    const isValid = await user.comparePassword(dto.password);
    if (!isValid) {
      throw new AppError('Invalid email or password', 401);
    }

    const tokens = this.generateTokens(user);
    return { user, tokens };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: { userId: string };
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    const user = await User.findById(payload.userId);
    if (!user) {
      throw new AppError('User not found', 401);
    }

    return this.generateTokens(user);
  }

  async forgotPassword(email: string): Promise<string> {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return 'If this email is registered, you will receive a reset link';
    }

    const rawToken = user.generateResetToken();
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.CLIENT_URL ?? `http://localhost:${env.port}`}/reset-password?token=${rawToken}`;
    void enqueueEmail({ type: 'passwordReset', to: user.email, resetUrl }).catch(() => {});

    return rawToken;
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');

    const user = await User.findOne({
      resetToken: hashed,
      resetTokenExp: { $gt: Date.now() },
    });

    if (!user) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    user.password = newPassword;
    user.resetToken = undefined;
    user.resetTokenExp = undefined;
    await user.save();
  }

  private generateTokens(user: IUser): AuthTokens {
    const userId = (user._id as object).toString();
    const accessToken = signAccessToken({ userId, role: user.role });
    const refreshToken = signRefreshToken({ userId });
    return { accessToken, refreshToken };
  }
}

export default new AuthService();
