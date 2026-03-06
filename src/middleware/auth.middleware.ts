import { Request, Response, NextFunction } from 'express';
import { AppError } from '@/utils/AppError';
import { verifyAccessToken } from '@/utils/tokenUtils';
import { isTokenBlacklisted } from '@/utils/tokenBlacklist';

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

    // Async blacklist check — we do NOT await in the sync middleware path;
    // instead we convert to a promise-based flow via next(err).
    isTokenBlacklisted(token).then((blacklisted) => {
      if (blacklisted) {
        next(new AppError('Token has been revoked. Please log in again.', 401));
      } else {
        next();
      }
    }).catch(() => next()); // fail-open: if Redis is down, let through

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
