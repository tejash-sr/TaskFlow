import { Worker, Job } from 'bullmq';
import { redisConnection } from '@/config/queue';
import { EmailJobData } from '@/queues/emailQueue';
import { welcomeEmail, verificationEmail, passwordResetEmail, taskAssignedEmail, projectMemberAddedEmail, commentAddedEmail, dailyDigestEmail, sendMail } from '@/utils/mailer';

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
        html: passwordResetEmail(data.name, data.resetUrl),
      });
      break;

    case 'taskAssigned': {
      const appUrl = process.env.CLIENT_URL || `http://localhost:${process.env.PORT || 5000}`;
      const taskUrl = `${appUrl}/tasks/${data.taskId}`;
      await sendMail({
        to: data.to,
        subject: `TaskFlow — New Task Assigned: ${data.taskTitle}`,
        html: taskAssignedEmail(data.assigneeName, data.taskTitle, data.projectName, taskUrl),
      });
      break;
    }

    case 'projectMemberAdded':
      await sendMail({
        to: data.to,
        subject: `TaskFlow — You've Been Added to ${data.projectName}`,
        html: projectMemberAddedEmail(data.memberName, data.projectName, data.ownerName),
      });
      break;

    case 'commentAdded': {
      const appUrl = process.env.CLIENT_URL || `http://localhost:${process.env.PORT || 5000}`;
      const taskUrl = data.taskUrl || `${appUrl}/tasks`;
      await sendMail({
        to: data.to,
        subject: `TaskFlow — New Comment on "${data.taskTitle}"`,
        html: commentAddedEmail(data.assigneeName, data.commenterName, data.taskTitle, data.projectName, taskUrl),
      });
      break;
    }

    case 'dailyDigest':
      await sendMail({
        to: data.to,
        subject: `TaskFlow — Daily Digest: ${data.overdueCount} overdue task${data.overdueCount === 1 ? '' : 's'}`,
        html: dailyDigestEmail(data.name, data.overdueCount, data.tasks),
      });
      break;

    default:
      throw new Error(`Unknown email job type: ${(data as { type: string }).type}`);
  }
}

// BUG-09 fix: exported for direct fallback when Redis/BullMQ unavailable
export async function processEmailDirect(data: EmailJobData): Promise<void> {
  return processEmailJob({ data } as Job<EmailJobData>);
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
