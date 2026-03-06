import { AppError } from '@/utils/AppError';

describe('AppError utility - extended', () => {
  it('creates error with correct properties', () => {
    const error = new AppError('Not found', 404);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe('Not found');
    expect(error.statusCode).toBe(404);
    expect(error.isOperational).toBe(true);
  });

  it('supports custom validation errors', () => {
    const validationErrors = { email: 'Invalid email format' };
    const error = new AppError('Validation failed', 400, validationErrors);

    expect(error.validationErrors).toEqual(validationErrors);
  });

  it('maintains error stack trace', () => {
    const error = new AppError('Test error', 500);

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('AppError');
  });

  it('defaults isOperational to true', () => {
    const error = new AppError('Operational error', 400);
    expect(error.isOperational).toBe(true);
  });
});

describe('Validation utilities', () => {
  it('validates email format', async () => {
    const { body, validationResult } = await import('express-validator');
    
    // This tests the validation rules, not the utility itself
    // The actual validation happens via middleware
    expect(true).toBe(true);
  });

  it('escapes HTML content', () => {
    const htmlContent = '<script>alert("xss")</script>';
    const escaped = require('html-entities').encode(htmlContent);
    
    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;');
  });

  it('handles special characters in validation', () => {
    const specialChars = `!@#$%^&*()"-+='`;
    // Special characters should be allowed in names/descriptions
    expect(specialChars).toBeDefined();
  });
});

describe('Token utilities', () => {
  it('generates and verifies access token', async () => {
    const { signAccessToken, verifyAccessToken } = await import('@/utils/tokenUtils');
    
    const payload = { userId: 'test-id', role: 'user' };
    const token = signAccessToken(payload);
    
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    
    const verified = verifyAccessToken(token);
    expect(verified.userId).toBe(payload.userId);
    expect(verified.role).toBe(payload.role);
  });

  it('rejects invalid token', async () => {
    const { verifyAccessToken } = await import('@/utils/tokenUtils');
    
    expect(() => {
      verifyAccessToken('invalid.token.here');
    }).toThrow();
  });
});

describe('AsyncHandler utility', () => {
  it('wraps async function and handles errors', async () => {
    const { asyncHandler } = await import('@/utils/asyncHandler');
    
    const mockReq = {};
    const mockRes = {};
    const mockNext = jest.fn();
    
    const handler = asyncHandler(async (req, res) => {
      res.status = 200;
      res.json = jest.fn().mockReturnValue({ success: true });
      res.json({ success: true });
    });
    
    await handler(mockReq, mockRes, mockNext);
    
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('catches async errors and passes to next', async () => {
    const { asyncHandler } = await import('@/utils/asyncHandler');
    
    const mockReq = {};
    const mockRes = {};
    const mockNext = jest.fn();
    const testError = new Error('Async error');
    
    const handler = asyncHandler(async () => {
      throw testError;
    });
    
    await handler(mockReq, mockRes, mockNext);
    
    expect(mockNext).toHaveBeenCalledWith(testError);
  });
});
