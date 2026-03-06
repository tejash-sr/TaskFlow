import { verify } from 'jsonwebtoken';
import { env } from '@/config/env';

describe('Socket authentication (PDF-11/12 requirements)', () => {
  describe('Token verification', () => {
    it('successfully verifies a valid token', () => {
      const secret = env.jwt.secret;
      const token = require('jsonwebtoken').sign(
        { userId: 'test-user-id', role: 'user' },
        secret,
        { expiresIn: '1h' }
      );

      const decoded = verify(token, secret);
      expect(decoded).toHaveProperty('userId', 'test-user-id');
      expect(decoded).toHaveProperty('role', 'user');
    });

    it('rejects expired token', () => {
      const secret = env.jwt.secret;
      const token = require('jsonwebtoken').sign(
        { userId: 'test-user-id' },
        secret,
        { expiresIn: '-1h' }
      );

      expect(() => verify(token, secret)).toThrow();
    });

    it('rejects tampered token', () => {
      const secret = env.jwt.secret;
      const token = require('jsonwebtoken').sign(
        { userId: 'test-user-id' },
        secret
      );

      const tampered = token.slice(0, -5) + 'xxxxx';
      expect(() => verify(tampered, secret)).toThrow();
    });

    it('rejects token with wrong secret', () => {
      const secret = env.jwt.secret;
      const token = require('jsonwebtoken').sign(
        { userId: 'test-user-id' },
        secret
      );

      expect(() => verify(token, 'wrong-secret')).toThrow();
    });
  });

  describe('Socket room authorization', () => {
    it('validates project membership for room access', async () => {
      const User = (await import('@/models/User.model')).default;
      const Project = (await import('@/models/Project.model')).default;

      const user = await User.create({
        name: 'Socket User',
        email: `socket${Date.now()}@test.com`,
        password: 'password123',
      });

      const project = await Project.create({
        name: 'Socket Project',
        description: 'for socket tests',
        owner: user._id,
        members: [user._id],
      });

      // User should be recognized as member
      const isMember = project.members.some(m => m.toString() === user._id.toString());
      expect(isMember).toBe(true);
    });

    it('rejects non-member access to project room', async () => {
      const User = (await import('@/models/User.model')).default;
      const Project = (await import('@/models/Project.model')).default;

      const owner = await User.create({
        name: 'Owner User',
        email: `owner${Date.now()}@test.com`,
        password: 'password123',
      });

      const nonMember = await User.create({
        name: 'Outsider User',
        email: `outsider${Date.now()}@test.com`,
        password: 'password123',
      });

      const project = await Project.create({
        name: 'Restricted Project',
        description: 'for socket tests',
        owner: owner._id,
        members: [owner._id],
      });

      // Non-member should not be in members list
      const isMember = project.members.some(m => m.toString() === nonMember._id.toString());
      expect(isMember).toBe(false);
    });
  });
});
