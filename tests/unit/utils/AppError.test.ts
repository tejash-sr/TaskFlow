import { AppError } from '@/utils/AppError';

describe('AppError', () => {
  it('creates an error with message and statusCode', () => {
    const err = new AppError('Not found', 404);

    expect(err.message).toBe('Not found');
    expect(err.statusCode).toBe(404);
    expect(err.isOperational).toBe(true);
    expect(err).toBeInstanceOf(Error);
  });

  it('marks the error as operational', () => {
    const err = new AppError('Forbidden', 403);

    expect(err.isOperational).toBe(true);
  });

  it('stores optional validation errors', () => {
    const errors = [{ field: 'email', message: 'Required' }];
    const err = new AppError('Validation failed', 400, errors);

    expect(err.errors).toEqual(errors);
  });

  it('sets the name to AppError', () => {
    const err = new AppError('Test', 500);

    expect(err.name).toBe('AppError');
  });

  it('has no errors property when none are provided', () => {
    const err = new AppError('Simple error', 400);

    expect(err.errors).toBeUndefined();
  });
});
