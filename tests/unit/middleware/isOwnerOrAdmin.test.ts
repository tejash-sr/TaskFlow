import { isOwnerOrAdmin } from '@/middleware/auth.middleware';
import { AppError } from '@/utils/AppError';
import { Request, Response, NextFunction } from 'express';

describe('PDF-05: isOwnerOrAdmin middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = { userId: 'user-123', userRole: 'user' };
    mockRes = {};
    mockNext = jest.fn();
  });

  it('allows admin to access any resource', async () => {
    const middleware = isOwnerOrAdmin(async () => 'different-owner');
    mockReq.userRole = 'admin';
    
    await middleware(mockReq as Request, mockRes as Response, mockNext);
    expect(mockNext).toHaveBeenCalledWith();
  });

  it('allows owner (matching userId) to access resource', async () => {
    const middleware = isOwnerOrAdmin(async () => 'user-123');
    
    await middleware(mockReq as Request, mockRes as Response, mockNext);
    expect(mockNext).toHaveBeenCalledWith();
  });

  it('denies non-owner non-admin from accessing resource', async () => {
    const middleware = isOwnerOrAdmin(async () => 'different-owner');
    
    await middleware(mockReq as Request, mockRes as Response, mockNext);
    
    const error = (mockNext as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(403);
    expect(error.message).toContain('Forbidden');
  });

  it('handles sync getOwnerId function', async () => {
    const middleware = isOwnerOrAdmin(() => 'user-123');
    
    await middleware(mockReq as Request, mockRes as Response, mockNext);
    expect(mockNext).toHaveBeenCalledWith();
  });

  it('handles async getOwnerId returning undefined', async () => {
    const middleware = isOwnerOrAdmin(async () => undefined);
    
    await middleware(mockReq as Request, mockRes as Response, mockNext);
    
    const error = (mockNext as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(403);
  });

  it('catches and passes errors from async getOwnerId', async () => {
    const testError = new Error('Database error');
    const middleware = isOwnerOrAdmin(async () => {
      throw testError;
    });
    
    await middleware(mockReq as Request, mockRes as Response, mockNext);
    
    const error = (mockNext as jest.Mock).mock.calls[0][0];
    expect(error).toBe(testError);
  });
});
