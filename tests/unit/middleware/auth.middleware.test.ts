import { Request, Response, NextFunction } from 'express';
import { AppError } from '@/utils/AppError';

jest.mock('@/utils/tokenUtils');
jest.mock('@/utils/tokenBlacklist');

import { verifyAccessToken } from '@/utils/tokenUtils';
import { isTokenBlacklisted } from '@/utils/tokenBlacklist';
import { isAuth, isAdmin, isOwnerOrAdmin } from '@/middleware/auth.middleware';

const mockVerifyAccessToken = verifyAccessToken as jest.MockedFunction<typeof verifyAccessToken>;
const mockIsTokenBlacklisted = isTokenBlacklisted as jest.MockedFunction<typeof isTokenBlacklisted>;

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    userId: undefined,
    userRole: undefined,
    ...overrides,
  } as unknown as Request;
}

function makeRes(): Response {
  return {} as Response;
}

function makeNext(): jest.Mock {
  return jest.fn();
}

describe('auth.middleware', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('isAuth', () => {
    it('calls next with 401 when no Authorization header', () => {
      const req = makeReq({ headers: {} });
      const next = makeNext();

      isAuth(req, makeRes(), next as unknown as NextFunction);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });

    it('calls next with 401 when Authorization header does not start with Bearer', () => {
      const req = makeReq({ headers: { authorization: 'Token abc123' } });
      const next = makeNext();

      isAuth(req, makeRes(), next as unknown as NextFunction);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });

    it('calls next with error when token verification fails', () => {
      const req = makeReq({ headers: { authorization: 'Bearer badtoken' } });
      const next = makeNext();

      mockVerifyAccessToken.mockImplementation(() => {
        throw new AppError('Invalid token', 401);
      });

      isAuth(req, makeRes(), next as unknown as NextFunction);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });

    it('calls next with 401 when token is blacklisted', async () => {
      const req = makeReq({ headers: { authorization: 'Bearer validtoken' } });
      const next = makeNext();

      mockVerifyAccessToken.mockReturnValue({ userId: 'user123', role: 'user' });
      mockIsTokenBlacklisted.mockResolvedValue(true);

      isAuth(req, makeRes(), next as unknown as NextFunction);

      // Wait for the async blacklist check
      await new Promise((resolve) => setImmediate(resolve));

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });

    it('calls next() without error when token is valid and not blacklisted', async () => {
      const req = makeReq({ headers: { authorization: 'Bearer validtoken' } });
      const next = makeNext();

      mockVerifyAccessToken.mockReturnValue({ userId: 'user123', role: 'user' });
      mockIsTokenBlacklisted.mockResolvedValue(false);

      isAuth(req, makeRes(), next as unknown as NextFunction);

      await new Promise((resolve) => setImmediate(resolve));

      expect(next).toHaveBeenCalledWith(); // called with no arguments = success
      expect(req.userId).toBe('user123');
      expect(req.userRole).toBe('user');
    });

    it('calls next() fail-open when blacklist check throws', async () => {
      const req = makeReq({ headers: { authorization: 'Bearer validtoken' } });
      const next = makeNext();

      mockVerifyAccessToken.mockReturnValue({ userId: 'user123', role: 'user' });
      mockIsTokenBlacklisted.mockRejectedValue(new Error('Redis down'));

      isAuth(req, makeRes(), next as unknown as NextFunction);

      await new Promise((resolve) => setImmediate(resolve));

      // fail-open: next() called without error when Redis is down
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('isAdmin', () => {
    it('calls next with 403 when user is not admin', () => {
      const req = makeReq({ userRole: 'user' } as Partial<Request>);
      const next = makeNext();

      isAdmin(req, makeRes(), next as unknown as NextFunction);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    });

    it('calls next() when user is admin', () => {
      const req = makeReq({ userRole: 'admin' } as Partial<Request>);
      const next = makeNext();

      isAdmin(req, makeRes(), next as unknown as NextFunction);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('isOwnerOrAdmin', () => {
    it('calls next() when user is admin (bypasses owner check)', () => {
      const req = makeReq({ userRole: 'admin', userId: 'admin1' } as Partial<Request>);
      const next = makeNext();

      isOwnerOrAdmin(() => 'someOtherId')(req, makeRes(), next as unknown as NextFunction);

      expect(next).toHaveBeenCalledWith();
    });

    it('calls next() when userId matches ownerId (sync)', () => {
      const req = makeReq({ userRole: 'user', userId: 'user123' } as Partial<Request>);
      const next = makeNext();

      isOwnerOrAdmin(() => 'user123')(req, makeRes(), next as unknown as NextFunction);

      expect(next).toHaveBeenCalledWith();
    });

    it('calls next with 403 when userId does not match ownerId (sync)', () => {
      const req = makeReq({ userRole: 'user', userId: 'user123' } as Partial<Request>);
      const next = makeNext();

      isOwnerOrAdmin(() => 'differentUser')(req, makeRes(), next as unknown as NextFunction);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    });

    it('calls next with 403 when ownerId is undefined (sync)', () => {
      const req = makeReq({ userRole: 'user', userId: 'user123' } as Partial<Request>);
      const next = makeNext();

      isOwnerOrAdmin(() => undefined)(req, makeRes(), next as unknown as NextFunction);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    });

    it('calls next() when userId matches ownerId (async)', async () => {
      const req = makeReq({ userRole: 'user', userId: 'user123' } as Partial<Request>);
      const next = makeNext();

      isOwnerOrAdmin(async () => 'user123')(req, makeRes(), next as unknown as NextFunction);

      await new Promise((resolve) => setImmediate(resolve));

      expect(next).toHaveBeenCalledWith();
    });

    it('calls next with 403 when userId does not match ownerId (async)', async () => {
      const req = makeReq({ userRole: 'user', userId: 'user123' } as Partial<Request>);
      const next = makeNext();

      isOwnerOrAdmin(async () => 'differentUser')(req, makeRes(), next as unknown as NextFunction);

      await new Promise((resolve) => setImmediate(resolve));

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    });

    it('calls next with error when async getOwnerId throws', async () => {
      const req = makeReq({ userRole: 'user', userId: 'user123' } as Partial<Request>);
      const next = makeNext();

      isOwnerOrAdmin(async () => { throw new Error('DB error'); })(req, makeRes(), next as unknown as NextFunction);

      await new Promise((resolve) => setImmediate(resolve));

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
