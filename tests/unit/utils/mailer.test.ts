import {
  sendMail,
  transporter,
  welcomeEmail,
  verificationEmail,
  passwordResetEmail,
  taskAssignedEmail,
  projectMemberAddedEmail,
  commentAddedEmail,
  dailyDigestEmail,
} from '@/utils/mailer';
import { env } from '@/config/env';

// NODE_ENV=test so sendMail is a no-op — this is correct behaviour
describe('mailer utility', () => {
  describe('sendMail', () => {
    it('resolves without throwing in test mode', async () => {
      await expect(
        sendMail({ to: 'test@example.com', subject: 'Test', html: '<p>Hi</p>' }),
      ).resolves.not.toThrow();
    });

    it('resolves even with empty html', async () => {
      await expect(
        sendMail({ to: 'x@y.com', subject: 'S', html: '' }),
      ).resolves.not.toThrow();
    });

    it('logs to stdout when not in test mode and no SMTP configured', async () => {
      const originalIsTest = env.isTest;
      (env as Record<string, unknown>).isTest = false;
      const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      try {
        await sendMail({ to: 'dev@example.com', subject: 'Dev', html: '<p>Dev email</p>' });
        expect(stdoutSpy).toHaveBeenCalled();
      } finally {
        stdoutSpy.mockRestore();
        (env as Record<string, unknown>).isTest = originalIsTest;
      }
    });

    it('logs to stdout with text option when not in test mode', async () => {
      const originalIsTest = env.isTest;
      (env as Record<string, unknown>).isTest = false;
      const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      try {
        await sendMail({ to: 'dev@example.com', subject: 'Dev', html: '<p>Hi</p>', text: 'Hi' });
        expect(stdoutSpy).toHaveBeenCalled();
      } finally {
        stdoutSpy.mockRestore();
        (env as Record<string, unknown>).isTest = originalIsTest;
      }
    });

    it('calls transporter.sendMail when SMTP is configured', async () => {
      const originalIsTest = env.isTest;
      const originalHost = env.email.host;
      (env as Record<string, unknown>).isTest = false;
      (env.email as Record<string, unknown>).host = 'smtp.example.com';
      const sendMailSpy = jest.spyOn(transporter, 'sendMail').mockResolvedValue({} as never);
      try {
        await sendMail({ to: 'smtp@example.com', subject: 'SMTP', html: '<p>test</p>' });
        expect(sendMailSpy).toHaveBeenCalled();
      } finally {
        sendMailSpy.mockRestore();
        (env as Record<string, unknown>).isTest = originalIsTest;
        (env.email as Record<string, unknown>).host = originalHost;
      }
    });

    it('logs to stderr when SMTP send fails without throwing', async () => {
      const originalIsTest = env.isTest;
      const originalHost = env.email.host;
      (env as Record<string, unknown>).isTest = false;
      (env.email as Record<string, unknown>).host = 'smtp.example.com';
      const sendMailSpy = jest.spyOn(transporter, 'sendMail').mockRejectedValue(new Error('SMTP Error'));
      const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
      try {
        await expect(sendMail({ to: 'fail@example.com', subject: 'Fail', html: '<p>fail</p>' })).resolves.not.toThrow();
        expect(stderrSpy).toHaveBeenCalled();
      } finally {
        sendMailSpy.mockRestore();
        stderrSpy.mockRestore();
        (env as Record<string, unknown>).isTest = originalIsTest;
        (env.email as Record<string, unknown>).host = originalHost;
      }
    });
  });

  describe('welcomeEmail', () => {
    it('contains the user name', () => {
      const html = welcomeEmail('Alice');
      expect(html).toContain('Alice');
    });

    it('contains TaskFlow branding', () => {
      const html = welcomeEmail('Bob');
      expect(html).toContain('TaskFlow');
    });

    it('contains the dashboard link', () => {
      const html = welcomeEmail('Charlie');
      expect(html).toContain('/dashboard');
    });

    it('contains Get Started CTA', () => {
      const html = welcomeEmail('Dave');
      expect(html).toContain('Get Started');
    });
  });

  describe('verificationEmail', () => {
    it('contains the user name', () => {
      const html = verificationEmail('Alice', 'https://example.com/verify?token=abc');
      expect(html).toContain('Alice');
    });

    it('contains the verify URL', () => {
      const verifyUrl = 'https://example.com/verify?token=test123';
      const html = verificationEmail('Bob', verifyUrl);
      expect(html).toContain(verifyUrl);
    });

    it('contains 24 hour expiry info', () => {
      const html = verificationEmail('Charlie', 'https://x.com');
      expect(html).toContain('24');
    });
  });

  describe('passwordResetEmail', () => {
    it('contains the reset URL', () => {
      const html = passwordResetEmail('Bob', 'https://example.com/reset?token=abc123');
      expect(html).toContain('https://example.com/reset?token=abc123');
    });

    it('contains the user name', () => {
      const html = passwordResetEmail('Alice', 'https://reset.url');
      expect(html).toContain('Alice');
    });

    it('contains 1 hour expiry warning', () => {
      const html = passwordResetEmail('Dave', 'https://reset.url');
      expect(html).toContain('1 hour');
    });
  });

  describe('taskAssignedEmail', () => {
    it('contains task title', () => {
      const html = taskAssignedEmail('Carol', 'Fix the bug', 'My Project');
      expect(html).toContain('Fix the bug');
    });

    it('contains project name', () => {
      const html = taskAssignedEmail('Carol', 'Fix the bug', 'My Project');
      expect(html).toContain('My Project');
    });

    it('contains assignee name', () => {
      const html = taskAssignedEmail('Carol', 'Fix the bug', 'My Project');
      expect(html).toContain('Carol');
    });

    it('includes task URL when provided', () => {
      const html = taskAssignedEmail('Dave', 'Task', 'Project', 'https://app.com/tasks/123');
      expect(html).toContain('https://app.com/tasks/123');
    });
  });

  describe('projectMemberAddedEmail', () => {
    it('contains member name', () => {
      const html = projectMemberAddedEmail('Eve', 'Alpha Project', 'Frank');
      expect(html).toContain('Eve');
    });

    it('contains project name', () => {
      const html = projectMemberAddedEmail('Eve', 'Alpha Project', 'Frank');
      expect(html).toContain('Alpha Project');
    });

    it('contains owner name', () => {
      const html = projectMemberAddedEmail('Eve', 'Alpha Project', 'Frank');
      expect(html).toContain('Frank');
    });
  });

  describe('commentAddedEmail', () => {
    it('contains assignee name', () => {
      const html = commentAddedEmail('Alice', 'Bob', 'Task X', 'Project Y');
      expect(html).toContain('Alice');
    });

    it('contains commenter name', () => {
      const html = commentAddedEmail('Alice', 'Bob', 'Task X', 'Project Y');
      expect(html).toContain('Bob');
    });

    it('contains task title', () => {
      const html = commentAddedEmail('Alice', 'Bob', 'Fix Login Bug', 'Project Y');
      expect(html).toContain('Fix Login Bug');
    });

    it('contains project name', () => {
      const html = commentAddedEmail('Alice', 'Bob', 'Task X', 'Backend Project');
      expect(html).toContain('Backend Project');
    });
  });

  describe('dailyDigestEmail', () => {
    it('contains user name', () => {
      const html = dailyDigestEmail('Grace', 3);
      expect(html).toContain('Grace');
    });

    it('contains overdue count', () => {
      const html = dailyDigestEmail('Henry', 5);
      expect(html).toContain('5');
    });

    it('handles singular task correctly', () => {
      const html = dailyDigestEmail('Ivy', 1);
      expect(html).toContain('1');
    });

    it('handles zero overdue tasks', () => {
      const html = dailyDigestEmail('Jack', 0);
      expect(html).toContain('Jack');
    });

    it('renders task list when tasks provided', () => {
      const tasks = [
        { title: 'Overdue Task 1', dueDate: new Date('2024-01-01'), priority: 'high' },
        { title: 'Overdue Task 2', priority: 'urgent' },
      ];
      const html = dailyDigestEmail('Karen', 2, tasks);
      expect(html).toContain('Overdue Task 1');
      expect(html).toContain('Overdue Task 2');
    });
  });
});
