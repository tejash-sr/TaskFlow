import { Types } from 'mongoose';
import { AppError } from '@/utils/AppError';
import authService from '@/services/auth.service';

// Mock the User model
jest.mock('@/models/User.model');
import User from '@/models/User.model';

const MockedUser = User as jest.Mocked<typeof User>;

const makeUser = (overrides: Partial<{
  _id: Types.ObjectId;
  email: string;
  role: string;
  comparePassword: jest.Mock;
  generateResetToken: jest.Mock;
  resetToken: string | undefined;
  resetTokenExp: Date | undefined;
  save: jest.Mock;
}> = {}) => ({
  _id: new Types.ObjectId(),
  email: 'user@test.com',
  role: 'user',
  comparePassword: jest.fn().mockResolvedValue(true),
  generateResetToken: jest.fn().mockReturnValue('raw-reset-token'),
  resetToken: undefined,
  resetTokenExp: undefined,
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('AuthService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('signup', () => {
    it('throws 409 if email is already registered', async () => {
      (MockedUser.findOne as jest.Mock).mockResolvedValue(makeUser());
      await expect(
        authService.signup({ name: 'Alice', email: 'dupe@test.com', password: 'pw12345678' }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('creates a user and returns tokens when email is unique', async () => {
      (MockedUser.findOne as jest.Mock).mockResolvedValue(null);
      const user = makeUser();
      (MockedUser.create as jest.Mock).mockResolvedValue(user);

      const result = await authService.signup({
        name: 'Alice',
        email: 'new@test.com',
        password: 'password123',
      });

      expect(MockedUser.create).toHaveBeenCalled();
      expect(result.tokens).toHaveProperty('accessToken');
      expect(result.tokens).toHaveProperty('refreshToken');
    });
  });

  describe('login', () => {
    it('throws 401 when user is not found', async () => {
      (MockedUser.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });
      await expect(
        authService.login({ email: 'ghost@test.com', password: 'wrongpw' }),
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    it('throws 401 when password does not match', async () => {
      const user = makeUser({ comparePassword: jest.fn().mockResolvedValue(false) });
      (MockedUser.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });
      await expect(
        authService.login({ email: 'user@test.com', password: 'wrongpw' }),
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    it('returns tokens on successful login', async () => {
      const user = makeUser();
      (MockedUser.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      const result = await authService.login({ email: 'user@test.com', password: 'correctpw' });

      expect(result.tokens).toHaveProperty('accessToken');
      expect(result.tokens).toHaveProperty('refreshToken');
    });
  });

  describe('forgotPassword', () => {
    it('returns a safe message when email is not found', async () => {
      (MockedUser.findOne as jest.Mock).mockResolvedValue(null);
      const result = await authService.forgotPassword('missing@test.com');
      expect(typeof result).toBe('string');
    });

    it('calls generateResetToken and saves user when email exists', async () => {
      const user = makeUser();
      (MockedUser.findOne as jest.Mock).mockResolvedValue(user);

      await authService.forgotPassword('user@test.com');

      expect(user.generateResetToken).toHaveBeenCalled();
      expect(user.save).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('throws 400 when reset token is invalid', async () => {
      (MockedUser.findOne as jest.Mock).mockResolvedValue(null);
      await expect(
        authService.resetPassword('bad-token', 'newpassword'),
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });
});
