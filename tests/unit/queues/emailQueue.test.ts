/**
 * Unit tests for the email queue.
 *
 * We mock BullMQ's Queue so no Redis connection is needed.
 */

// Mock BullMQ before importing the queue module
jest.mock('bullmq', () => {
  const addMock = jest.fn().mockResolvedValue({ id: 'job-1' });
  const closeMock = jest.fn().mockResolvedValue(undefined);
  return {
    Queue: jest.fn().mockImplementation(() => ({
      add: addMock,
      close: closeMock,
    })),
    Worker: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

import { Queue } from 'bullmq';
import { enqueueEmail, getEmailQueue, EmailJobData } from '@/queues/emailQueue';

const MockQueue = Queue as jest.MockedClass<typeof Queue>;

describe('Email Queue', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.clearAllMocks();
    // Reset the singleton queue instance between tests
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (getEmailQueue as any)._queue = null;
  });

  it('getEmailQueue returns a Queue instance', () => {
    const queue = getEmailQueue();
    expect(queue).toBeDefined();
    expect(MockQueue).toHaveBeenCalledWith('email', expect.objectContaining({
      defaultJobOptions: expect.objectContaining({ attempts: 3 }),
    }));
  });

  it('enqueueEmail is a no-op in test environment', async () => {
    // NODE_ENV is 'test' by default in Jest
    const queue = getEmailQueue();
    const addSpy = jest.spyOn(queue, 'add');

    await enqueueEmail({ type: 'welcome', to: 'test@test.com', name: 'Test' });

    expect(addSpy).not.toHaveBeenCalled();
  });

  it('enqueueEmail calls queue.add in non-test environment', async () => {
    // Temporarily override the env.isTest flag via the module mock
    const envModule = await import('@/config/env');
    const original = envModule.env.isTest;
    // Override the property for this test
    (envModule.env as { isTest: boolean }).isTest = false;

    const queue = getEmailQueue();
    const addSpy = jest.spyOn(queue, 'add').mockResolvedValue({ id: 'job-1' } as never);

    const data: EmailJobData = { type: 'welcome', to: 'user@example.com', name: 'Test User' };
    await enqueueEmail(data);

    // Restore
    (envModule.env as { isTest: boolean }).isTest = original;

    expect(addSpy).toHaveBeenCalledWith('welcome', data);
  });

  it('supports all email job types', () => {
    const welcomeJob: EmailJobData = { type: 'welcome', to: 'a@b.com', name: 'A' };
    const resetJob: EmailJobData = { type: 'passwordReset', to: 'a@b.com', resetUrl: 'http://reset' };
    const assignedJob: EmailJobData = {
      type: 'taskAssigned',
      to: 'a@b.com',
      taskTitle: 'Fix Bug',
      taskId: '123',
    };

    // Type-check only — no runtime assertion needed
    expect(welcomeJob.type).toBe('welcome');
    expect(resetJob.type).toBe('passwordReset');
    expect(assignedJob.type).toBe('taskAssigned');
  });
});
