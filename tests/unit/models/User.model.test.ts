import User from '@/models/User.model';

describe('User model', () => {
  describe('validation', () => {
    it('saves a user with valid data', async () => {
      const user = new User({ email: 'test@example.com', password: 'password123', name: 'Test User' });
      const saved = await user.save();
      expect(saved._id).toBeDefined();
      expect(saved.email).toBe('test@example.com');
    });

    it('fails when email is missing', async () => {
      const user = new User({ password: 'password123', name: 'Test User' });
      await expect(user.save()).rejects.toThrow();
    });

    it('fails when email format is invalid', async () => {
      const user = new User({ email: 'not-an-email', password: 'password123', name: 'Test User' });
      await expect(user.save()).rejects.toThrow('Invalid email format');
    });

    it('fails when password is shorter than 8 characters', async () => {
      const user = new User({ email: 'a@b.com', password: 'short', name: 'Test User' });
      await expect(user.save()).rejects.toThrow();
    });

    it('fails when name is shorter than 2 characters', async () => {
      const user = new User({ email: 'a@b.com', password: 'password123', name: 'A' });
      await expect(user.save()).rejects.toThrow();
    });

    it('fails when name exceeds 50 characters', async () => {
      const user = new User({
        email: 'a@b.com',
        password: 'password123',
        name: 'A'.repeat(51),
      });
      await expect(user.save()).rejects.toThrow();
    });

    it('defaults role to user', async () => {
      const user = await new User({
        email: 'role@example.com',
        password: 'password123',
        name: 'Role Test',
      }).save();
      expect(user.role).toBe('user');
    });
  });

  describe('password hashing', () => {
    it('hashes the password on save', async () => {
      const plain = 'myplainpassword';
      const user = await new User({
        email: 'hash@example.com',
        password: plain,
        name: 'Hash Test',
      }).save();

      const fetched = await User.findById(user._id).select('+password');
      expect(fetched!.password).not.toBe(plain);
      expect(fetched!.password.startsWith('$2')).toBe(true);
    });

    it('does not re-hash when other fields are updated', async () => {
      const user = await new User({
        email: 'nrehash@example.com',
        password: 'password123',
        name: 'No Rehash',
      }).save();

      const before = (await User.findById(user._id).select('+password'))!.password;
      user.name = 'Updated Name';
      await user.save();
      const after = (await User.findById(user._id).select('+password'))!.password;

      expect(before).toBe(after);
    });
  });

  describe('comparePassword', () => {
    it('returns true for correct password', async () => {
      const plain = 'correctpassword';
      const user = await new User({
        email: 'compare@example.com',
        password: plain,
        name: 'Compare Test',
      }).save();

      const fetched = await User.findById(user._id).select('+password');
      await expect(fetched!.comparePassword(plain)).resolves.toBe(true);
    });

    it('returns false for incorrect password', async () => {
      const user = await new User({
        email: 'wrong@example.com',
        password: 'correctpassword',
        name: 'Wrong Test',
      }).save();

      const fetched = await User.findById(user._id).select('+password');
      await expect(fetched!.comparePassword('wrongpassword')).resolves.toBe(false);
    });
  });

  describe('generateResetToken', () => {
    it('returns a token and sets resetToken and resetTokenExp', async () => {
      const user = await new User({
        email: 'reset@example.com',
        password: 'password123',
        name: 'Reset Test',
      }).save();

      const token = user.generateResetToken();

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      expect(user.resetToken).toBeDefined();
      expect(user.resetTokenExp).toBeInstanceOf(Date);
      expect(user.resetTokenExp!.getTime()).toBeGreaterThan(Date.now());
    });

    it('stores a hashed version of the token, not the raw token', async () => {
      const user = await new User({
        email: 'hashtoken@example.com',
        password: 'password123',
        name: 'Hash Token',
      }).save();

      const raw = user.generateResetToken();
      expect(user.resetToken).not.toBe(raw);
    });
  });

  describe('toJSON', () => {
    it('omits password from the serialised output', async () => {
      const user = await new User({
        email: 'json@example.com',
        password: 'password123',
        name: 'JSON Test',
      }).save();

      const json = user.toJSON() as Record<string, unknown>;
      expect(json.password).toBeUndefined();
    });
  });
});
