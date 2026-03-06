import { Request, Response, NextFunction } from 'express';
import { AppError } from '@/utils/AppError';
import { verifyAccessToken } from '@/utils/tokenUtils';

export function isAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError('Authentication required', 401));
  }

  const token = header.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.userId;
    req.userRole = payload.role;
    next();
  } catch (err: unknown) {
    next(err);
  }
}

export function isAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.userRole !== 'admin') {
    return next(new AppError('Admin access required', 403));
  }
  next();
}

export function isOwnerOrAdmin(getOwnerId: (req: Request) => string | undefined) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.userRole === 'admin') return next();
    const ownerId = getOwnerId(req);
    if (ownerId && ownerId === req.userId) return next();
    next(new AppError('Forbidden: insufficient permissions', 403));
  };
}
