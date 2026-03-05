import { Request, Response, NextFunction } from 'express';
import { AppError } from '@/utils/AppError';
import { env } from '@/config/env';
import { logError } from '@/utils/logger';

interface MongoError extends Error {
  code?: number;
  keyValue?: Record<string, unknown>;
}

interface MongooseValidationError extends Error {
  name: 'ValidationError';
  errors: Record<string, { message: string }>;
}

interface MongooseCastError extends Error {
  name: 'CastError';
  path: string;
}

function isMongooseValidationError(err: Error): err is MongooseValidationError {
  return err.name === 'ValidationError' && 'errors' in err;
}

function isMongooseCastError(err: Error): err is MongooseCastError {
  return err.name === 'CastError';
}

function isMongoError(err: Error): err is MongoError {
  return (err as MongoError).code !== undefined;
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
      ...(err.errors && { errors: err.errors }),
    });
    return;
  }

  if (isMongooseValidationError(err)) {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.message.split(':')[0]?.trim() || 'unknown',
      message: e.message,
    }));
    res.status(400).json({ status: 'error', message: 'Validation failed', errors });
    return;
  }

  if (isMongooseCastError(err)) {
    res.status(400).json({
      status: 'error',
      message: `Invalid value for field: ${err.path}`,
    });
    return;
  }

  if (isMongoError(err) && err.code === 11000) {
    const field = Object.keys((err as MongoError).keyValue || {})[0] || 'field';
    res.status(409).json({
      status: 'error',
      message: `${field} already exists`,
    });
    return;
  }

  if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
    res.status(401).json({ status: 'error', message: 'Invalid or expired token' });
    return;
  }

  // Log unhandled errors (non-operational) with context
  logError(err, {
    method: _req.method,
    url: _req.url,
    ip: _req.ip,
    userAgent: _req.get('user-agent'),
  });

  const response: Record<string, unknown> = {
    status: 'error',
    message: 'Internal server error',
  };

  if (!env.isProduction) {
    response.stack = err.stack;
    response.detail = err.message;
  }

  res.status(500).json(response);
}
