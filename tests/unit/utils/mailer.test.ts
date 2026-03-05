import { sendMail, welcomeEmail, passwordResetEmail, taskAssignedEmail } from '@/utils/mailer';

describe('mailer utility', () => {
  it('sendMail does not throw with a stream transport', async () => {
    await expect(
      sendMail({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Hello</p>',
      }),
    ).resolves.not.toThrow();
  });

  it('welcomeEmail contains the user name', () => {
    const html = welcomeEmail('Alice');
    expect(html).toContain('Alice');
    expect(html).toContain('TaskFlow');
  });

  it('passwordResetEmail contains the reset URL', () => {
    const html = passwordResetEmail('Bob', 'https://example.com/reset?token=abc123');
    expect(html).toContain('https://example.com/reset?token=abc123');
    expect(html).toContain('Bob');
  });

  it('taskAssignedEmail contains task and project name', () => {
    const html = taskAssignedEmail('Carol', 'Fix the bug', 'My Project');
    expect(html).toContain('Fix the bug');
    expect(html).toContain('My Project');
  });
});
