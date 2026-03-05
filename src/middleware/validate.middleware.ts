import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { AppError } from '@/utils/AppError';

export function validate(chains: ValidationChain[]) {
  return [
    ...chains,
    (req: Request, _res: Response, next: NextFunction): void => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const formatted = errors.array().map((e) => ({
          field: e.type === 'field' ? (e as { path: string }).path : 'unknown',
          message: e.msg as string,
        }));
        return next(new AppError('Validation failed', 422, formatted));
      }
      next();
    },
  ];
}
