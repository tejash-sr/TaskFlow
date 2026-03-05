interface ValidationErrorItem {
  field: string;
  message: string;
}

export class AppError extends Error {
  readonly statusCode: number;
  readonly isOperational: boolean;
  readonly errors?: ValidationErrorItem[];

  constructor(message: string, statusCode: number, errors?: ValidationErrorItem[]) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = true;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}
