import jwt from 'jsonwebtoken';
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, decodeToken } from '@/utils/tokenUtils';

describe('tokenUtils', () => {
  const userId = 'test-user-id';
  const role = 'user';

  describe('signAccessToken', () => {
    it('returns a valid JWT string', () => {
      const token = signAccessToken({ userId, role });
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('embeds userId and role in the payload', () => {
      const token = signAccessToken({ userId, role });
      const decoded = jwt.decode(token) as { userId: string; role: string };
      expect(decoded.userId).toBe(userId);
      expect(decoded.role).toBe(role);
    });
  });

  describe('signRefreshToken', () => {
    it('returns a valid JWT string', () => {
      const token = signRefreshToken({ userId });
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });
  });

  describe('verifyAccessToken', () => {
    it('returns the payload for a valid token', () => {
      const token = signAccessToken({ userId, role });
      const payload = verifyAccessToken(token);
      expect(payload.userId).toBe(userId);
      expect(payload.role).toBe(role);
    });

    it('throws JsonWebTokenError for a tampered token', () => {
      expect(() => verifyAccessToken('invalid.token.here')).toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('returns the payload for a valid refresh token', () => {
      const token = signRefreshToken({ userId });
      const payload = verifyRefreshToken(token);
      expect(payload.userId).toBe(userId);
    });

    it('throws if the access secret is used to verify a refresh token', () => {
      const accessToken = signAccessToken({ userId, role });
      // Refresh token verifier uses a different secret → should throw
      expect(() => verifyRefreshToken(accessToken)).toThrow();
    });
  });

  describe('decodeToken', () => {
    it('returns the decoded payload for a valid token', () => {
      const token = signAccessToken({ userId, role });
      const decoded = decodeToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded).toHaveProperty('userId', userId);
    });

    it('returns null for an invalid / non-JWT string', () => {
      const decoded = decodeToken('not.a.valid.jwt');
      expect(decoded).toBeNull();
    });

    it('returns null for completely non-JWT input', () => {
      const decoded = decodeToken('plainstring');
      expect(decoded).toBeNull();
    });
  });
});
