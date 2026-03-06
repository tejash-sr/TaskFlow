import { Queue } from 'bullmq';
import { redisConnection } from '@/config/queue';
import { env } from '@/config/env';

export interface WelcomeEmailJob {
  type: 'welcome';
  to: string;
  name: string;
}

export interface VerifyEmailJob {
  type: 'verifyEmail';
  to: string;
  name: string;
  verifyUrl: string;
}

export interface PasswordResetEmailJob {
  type: 'passwordReset';
  to: string;
  resetUrl: string;
}

export interface TaskAssignedEmailJob {
  type: 'taskAssigned';
  to: string;
  taskTitle: string;
  taskId: string;
}

export type EmailJobData = WelcomeEmailJob | VerifyEmailJob | PasswordResetEmailJob | TaskAssignedEmailJob;

let _queue: Queue<EmailJobData> | null = null;

export function getEmailQueue(): Queue<EmailJobData> {
  if (!_queue) {
    _queue = new Queue<EmailJobData>('email', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
    const queueAsEmitter = _queue as unknown as { on?: (ev: string, cb: (err: Error) => void) => void };
    if (typeof queueAsEmitter.on === 'function') {
      queueAsEmitter.on('error', (_err) => {});
    }
  }
  return _queue;
}

export async function enqueueEmail(data: EmailJobData): Promise<void> {
  if (env.isTest) return;
  try {
    await getEmailQueue().add(data.type, data);
  } catch {
    process.stderr.write(`[EmailQueue] Redis unavailable — email job skipped (${data.type})\n`);
  }
}
