import { Worker, Job } from 'bullmq';
import { redisConnection } from '@/config/queue';
import { EmailJobData } from '@/queues/emailQueue';
import { welcomeEmail, verificationEmail, passwordResetEmail, taskAssignedEmail, sendMail } from '@/utils/mailer';

async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const data = job.data;

  switch (data.type) {
    case 'welcome':
      await sendMail({
        to: data.to,
        subject: 'Welcome to TaskFlow!',
        html: welcomeEmail(data.name),
      });
      break;

    case 'verifyEmail':
      await sendMail({
        to: data.to,
        subject: 'TaskFlow — Verify your email',
        html: verificationEmail(data.name, data.verifyUrl),
      });
      break;

    case 'passwordReset':
      await sendMail({
        to: data.to,
        subject: 'TaskFlow — Password Reset',
        html: passwordResetEmail('User', data.resetUrl),
      });
      break;

    case 'taskAssigned':
      await sendMail({
        to: data.to,
        subject: `TaskFlow — New Task Assigned: ${data.taskTitle}`,
        html: taskAssignedEmail('User', data.taskTitle, data.taskId),
      });
      break;

    default:
      throw new Error(`Unknown email job type: ${(data as { type: string }).type}`);
  }
}

export function startEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>('email', processEmailJob, {
    connection: redisConnection,
    concurrency: 5,
  });

  worker.on('completed', (job) => {
    process.stdout.write(`[EmailWorker] Job ${job.id} (${job.name}) completed\n`);
  });

  worker.on('failed', (job, err) => {
    process.stderr.write(
      `[EmailWorker] Job ${job?.id} (${job?.name}) failed: ${err.message}\n`,
    );
  });

  return worker;
}
