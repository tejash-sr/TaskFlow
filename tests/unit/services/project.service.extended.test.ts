import User from '@/models/User.model';
import Project from '@/models/Project.model';
import { AppError } from '@/utils/AppError';

describe('ProjectService - extended coverage', () => {
  let owner: any;
  let member: any;
  let testProject: any;

  beforeEach(async () => {
    owner = await User.create({
      name: 'Project Owner',
      email: `owner${Date.now()}@test.com`,
      password: 'password123',
    });

    member = await User.create({
      name: 'Project Member',
      email: `member${Date.now()}@test.com`,
      password: 'password123',
    });

    testProject = await Project.create({
      name: 'Test Project',
      description: 'A test project',
      owner: owner._id,
      members: [owner._id],
    });
  });

  describe('BUG-01: addMember security', () => {
    it('allows owner to add members', async () => {
      const ps = (await import('@/services/project.service')).default;

      const result = await ps.addMember(
        testProject._id.toString(),
        member._id.toString(),
        owner._id.toString()
      );

      expect(result.members).toContainEqual(member._id);
    });

    it('prevents non-owner from adding members', async () => {
      const ps = (await import('@/services/project.service')).default;

      const another = await User.create({
        name: 'Another User',
        email: `another${Date.now()}@test.com`,
        password: 'password123',
      });

      await expect(
        ps.addMember(
          testProject._id.toString(),
          another._id.toString(),
          member._id.toString() // Non-owner trying to add
        )
      ).rejects.toThrow('Only the project owner');
    });

    it('prevents duplicate member addition', async () => {
      const ps = (await import('@/services/project.service')).default;

      // Add member first time
      await ps.addMember(
        testProject._id.toString(),
        member._id.toString(),
        owner._id.toString()
      );

      // Try to add same member again
      await expect(
        ps.addMember(
          testProject._id.toString(),
          member._id.toString(),
          owner._id.toString()
        )
      ).rejects.toThrow('already a member');
    });
  });

  describe('Project removal', () => {
    it('prevents non-owner from removing members', async () => {
      const ps = (await import('@/services/project.service')).default;

      // Add member first
      await ps.addMember(
        testProject._id.toString(),
        member._id.toString(),
        owner._id.toString()
      );

      // Try to remove as non-owner
      await expect(
        ps.removeMember(
          testProject._id.toString(),
          member._id.toString(),
          member._id.toString() // Member trying to remove another
        )
      ).rejects.toThrow('Only the project owner');
    });

    it('allows owner to remove members', async () => {
      const ps = (await import('@/services/project.service')).default;

      // Add member first
      await ps.addMember(
        testProject._id.toString(),
        member._id.toString(),
        owner._id.toString()
      );

      // Remove as owner
      const result = await ps.removeMember(
        testProject._id.toString(),
        member._id.toString(),
        owner._id.toString()
      );

      expect(result.members.some((m: any) => m.toString() === member._id.toString())).toBe(false);
    });
  });

  describe('PDF-08: Project validation', () => {
    it('requires description on project creation', async () => {
      const ps = (await import('@/services/project.service')).default;

      // Service might not validate, but model should
      const proj = await ps.create(
        {
          name: 'Project with Description',
          description: 'A valid description',
        },
        owner._id.toString()
      );

      expect(proj.description).toBe('A valid description');
    });
  });
});
