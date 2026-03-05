import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '@/middleware/error.middleware';
import { AppError } from '@/utils/AppError';

const mockRequest = () => ({} as Request);
const mockNext = jest.fn() as NextFunction;

function mockResponse(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('errorHandler middleware', () => {
  describe('AppError', () => {
    it('returns the correct status code and message for an AppError', () => {
      const req = mockRequest();
      const res = mockResponse();
      const err = new AppError('Resource not found', 404);

      errorHandler(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'error', message: 'Resource not found' }),
      );
    });

    it('includes validation errors when provided', () => {
      const req = mockRequest();
      const res = mockResponse();
      const errors = [{ field: 'email', message: 'Invalid email' }];
      const err = new AppError('Validation failed', 400, errors);

      errorHandler(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ errors }),
      );
    });
  });

  describe('Mongoose ValidationError', () => {
    it('maps Mongoose ValidationError to 400 with field errors', () => {
      const req = mockRequest();
      const res = mockResponse();
      const err = Object.assign(new Error('Validation failed'), {
        name: 'ValidationError',
        errors: {
          email: { message: 'email: Invalid email format' },
        },
      });

      errorHandler(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'error', message: 'Validation failed' }),
      );
    });
  });

  describe('Mongoose CastError', () => {
    it('maps CastError to 400', () => {
      const req = mockRequest();
      const res = mockResponse();
      const err = Object.assign(new Error('Cast error'), {
        name: 'CastError',
        path: '_id',
      });

      errorHandler(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('MongoDB duplicate key error', () => {
    it('maps duplicate key error (code 11000) to 409', () => {
      const req = mockRequest();
      const res = mockResponse();
      const err = Object.assign(new Error('Duplicate key'), {
        code: 11000,
        keyValue: { email: 'test@test.com' },
      });

      errorHandler(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'email already exists' }),
      );
    });
  });

  describe('JWT errors', () => {
    it('maps TokenExpiredError to 401', () => {
      const req = mockRequest();
      const res = mockResponse();
      const err = Object.assign(new Error('jwt expired'), { name: 'TokenExpiredError' });

      errorHandler(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('maps JsonWebTokenError to 401', () => {
      const req = mockRequest();
      const res = mockResponse();
      const err = Object.assign(new Error('invalid token'), { name: 'JsonWebTokenError' });

      errorHandler(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('unknown errors', () => {
    it('returns 500 for unhandled errors', () => {
      const req = mockRequest();
      const res = mockResponse();
      const err = new Error('Something exploded');

      errorHandler(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Internal server error' }),
      );
    });
  });
});
