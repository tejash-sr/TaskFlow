/**
 * Unit tests for tokenBlacklist utility.
 * In test mode Redis is always null (env.isTest=true), so the functions
 * return gracefully without doing anything.
 */
import { blacklistToken, isTokenBlacklisted } from '@/utils/tokenBlacklist';

describe('tokenBlacklist', () => {
  describe('blacklistToken (test mode — Redis disabled)', () => {
    it('resolves without error when called with a positive TTL', async () => {
      await expect(blacklistToken('some-token-jti', 3600)).resolves.toBeUndefined();
    });

    it('resolves without error when TTL is zero', async () => {
      await expect(blacklistToken('some-token-jti', 0)).resolves.toBeUndefined();
    });

    it('resolves without error when TTL is negative', async () => {
      await expect(blacklistToken('some-token-jti', -1)).resolves.toBeUndefined();
    });

    it('resolves without error for empty string token', async () => {
      await expect(blacklistToken('', 100)).resolves.toBeUndefined();
    });
  });

  describe('isTokenBlacklisted (test mode — Redis disabled)', () => {
    it('returns false for any token (Redis is null in test mode)', async () => {
      const result = await isTokenBlacklisted('any-token');
      expect(result).toBe(false);
    });

    it('returns false for empty string token', async () => {
      const result = await isTokenBlacklisted('');
      expect(result).toBe(false);
    });

    it('returns false even for a previously "blacklisted" token (no-op in tests)', async () => {
      await blacklistToken('mytoken', 3600);
      const result = await isTokenBlacklisted('mytoken');
      expect(result).toBe(false);
    });
  });
});
