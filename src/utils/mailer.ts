import nodemailer from 'nodemailer';
import { env } from '@/config/env';

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const DEV_HOSTS = ['localhost', '127.0.0.1', ''];

function isDevMode() {
  return env.isTest || !env.email.host || DEV_HOSTS.includes(env.email.host.toLowerCase());
}

function createTransporter() {
  if (isDevMode()) {
    return nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true,
    });
  }

  return nodemailer.createTransport({
    host: env.email.host,
    port: env.email.port,
    secure: env.email.port === 465,
    auth: {
      user: env.email.user,
      pass: env.email.password,
    },
  });
}

export const transporter = createTransporter();

export async function sendMail(options: MailOptions): Promise<void> {
  if (isDevMode()) {
    const textBody = options.text ?? options.html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    // eslint-disable-next-line no-console
    console.log('\n===== [DEV EMAIL] =====');
    // eslint-disable-next-line no-console
    console.log(`To:      ${options.to}`);
    // eslint-disable-next-line no-console
    console.log(`Subject: ${options.subject}`);
    // eslint-disable-next-line no-console
    console.log(`Body:    ${textBody.substring(0, 500)}`);
    // eslint-disable-next-line no-console
    console.log('========================\n');
    return;
  }
  await transporter.sendMail({
    from: env.email.user || 'taskflow@example.com',
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text ?? options.html.replace(/<[^>]*>/g, ''),
  });
}


export function passwordResetEmail(name: string, resetUrl: string): MailOptions['html'] {
  return `
    <h2>TaskFlow — Password Reset Request</h2>
    <p>Hi ${name},</p>
    <p>You requested a password reset. Click the link below (valid 1 hour):</p>
    <a href="${resetUrl}" style="background:#4f46e5;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;">
      Reset Password
    </a>
    <p>If you did not request this, please ignore this email.</p>
  `;
}

export function welcomeEmail(name: string): MailOptions['html'] {
  return `
    <h2>Welcome to TaskFlow, ${name}!</h2>
    <p>Your account has been created successfully.</p>
    <p>Start organising your tasks and projects at <a href="http://localhost:${env.port}">TaskFlow</a>.</p>
  `;
}

export function verificationEmail(name: string, verifyUrl: string): MailOptions['html'] {
  return `
    <h2>Verify your TaskFlow email, ${name}!</h2>
    <p>Click the button below to verify your email address (valid 24 hours):</p>
    <a href="${verifyUrl}" style="background:#4f46e5;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;display:inline-block;margin:16px 0;">
      Verify Email
    </a>
    <p>If you did not sign up for TaskFlow, please ignore this email.</p>
  `;
}

export function taskAssignedEmail(assigneeName: string, taskTitle: string, projectName: string): MailOptions['html'] {
  return `
    <h2>TaskFlow — New Task Assigned</h2>
    <p>Hi ${assigneeName},</p>
    <p>You have been assigned a new task: <strong>${taskTitle}</strong> in project <strong>${projectName}</strong>.</p>
    <p>Log in to view the details.</p>
  `;
}

export function projectMemberAddedEmail(memberName: string, projectName: string, ownerName: string): MailOptions['html'] {
  return `
    <h2>TaskFlow — You've Been Added to a Project</h2>
    <p>Hi ${memberName},</p>
    <p><strong>${ownerName}</strong> has added you to the project: <strong>${projectName}</strong>.</p>
    <p>You can now view and manage tasks in this project.</p>
    <p>Log in to get started.</p>
  `;
}
