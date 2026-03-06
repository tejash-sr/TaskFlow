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
    from: `"TaskFlow" <${env.email.user || 'noreply@taskflow.app'}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text ?? options.html.replace(/<[^>]*>/g, ''),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared email layout wrapper — beautiful, responsive, production-grade
// ─────────────────────────────────────────────────────────────────────────────
function emailWrapper(content: string, preheader = ''): string {
  const appUrl = process.env.CLIENT_URL || `http://localhost:${env.port}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>TaskFlow</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #f0f2f5; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased; }
    .email-wrapper { background: #f0f2f5; padding: 32px 16px; }
    .email-container { max-width: 560px; margin: 0 auto; }
    .email-header { text-align: center; padding: 24px 0 20px; }
    .brand { display: inline-flex; align-items: center; gap: 8px; text-decoration: none; }
    .brand-icon { width: 36px; height: 36px; background: #6366f1; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; font-size: 18px; color: white; }
    .brand-name { font-size: 1.3rem; font-weight: 700; color: #111827; letter-spacing: -0.02em; }
    .brand-accent { color: #6366f1; }
    .email-card { background: #ffffff; border-radius: 16px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
    .email-hero { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 36px 40px 32px; text-align: center; }
    .email-hero-icon { width: 64px; height: 64px; background: rgba(255,255,255,0.2); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 28px; color: white; margin-bottom: 16px; backdrop-filter: blur(10px); }
    .email-hero-title { font-size: 1.5rem; font-weight: 700; color: #ffffff; line-height: 1.3; letter-spacing: -0.02em; }
    .email-body { padding: 36px 40px; }
    .greeting { font-size: 1rem; font-weight: 500; color: #374151; margin-bottom: 16px; }
    .email-text { font-size: 0.9375rem; color: #6b7280; line-height: 1.7; margin-bottom: 16px; }
    .email-text strong { color: #111827; font-weight: 600; }
    .cta-wrapper { text-align: center; margin: 28px 0; }
    .cta-btn { display: inline-block; padding: 14px 32px; background: #6366f1; color: #ffffff !important; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 0.9375rem; letter-spacing: -0.01em; box-shadow: 0 4px 14px rgba(99,102,241,0.35); transition: background 0.2s; }
    .cta-btn-success { background: #10b981; box-shadow: 0 4px 14px rgba(16,185,129,0.35); }
    .cta-btn-warning { background: #f59e0b; box-shadow: 0 4px 14px rgba(245,158,11,0.35); }
    .divider { height: 1px; background: #f3f4f6; margin: 24px 0; }
    .info-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 20px; margin: 20px 0; }
    .info-box-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af; font-weight: 600; margin-bottom: 4px; }
    .info-box-value { font-size: 0.9375rem; font-weight: 600; color: #111827; }
    .stats-row { display: flex; gap: 12px; margin: 20px 0; }
    .stat-box { flex: 1; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; text-align: center; }
    .stat-value { font-size: 1.5rem; font-weight: 700; color: #6366f1; line-height: 1; }
    .stat-label { font-size: 0.75rem; color: #9ca3af; margin-top: 4px; }
    .link-fallback { font-size: 0.8125rem; color: #9ca3af; word-break: break-all; }
    .email-footer { padding: 20px 40px 28px; text-align: center; border-top: 1px solid #f3f4f6; }
    .footer-text { font-size: 0.8125rem; color: #9ca3af; line-height: 1.6; }
    .footer-link { color: #6366f1; text-decoration: none; }
    .priority-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 0.8125rem; font-weight: 600; }
    .priority-low { background: #d1fae5; color: #065f46; }
    .priority-medium { background: #fef3c7; color: #92400e; }
    .priority-high { background: #fee2e2; color: #991b1b; }
    .priority-urgent { background: #fce7f3; color: #9d174d; }
    @media (max-width: 600px) {
      .email-hero, .email-body, .email-footer { padding-left: 24px !important; padding-right: 24px !important; }
      .stats-row { flex-direction: column; }
    }
  </style>
</head>
<body>
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>` : ''}
  <div class="email-wrapper">
    <div class="email-container">
      <div class="email-header">
        <a href="${appUrl}" class="brand">
          <span class="brand-icon">⚡</span>
          <span class="brand-name">Task<span class="brand-accent">Flow</span></span>
        </a>
      </div>
      <div class="email-card">
        ${content}
      </div>
      <div style="text-align:center;padding:20px 0;">
        <p style="font-size:0.8125rem;color:#9ca3af;">
          © ${new Date().getFullYear()} TaskFlow · <a href="${appUrl}" style="color:#6366f1;text-decoration:none;">Visit App</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Email template functions
// ─────────────────────────────────────────────────────────────────────────────

export function passwordResetEmail(name: string, resetUrl: string): MailOptions['html'] {
  return emailWrapper(`
    <div class="email-hero">
      <div class="email-hero-icon">🔑</div>
      <h1 class="email-hero-title">Reset Your Password</h1>
    </div>
    <div class="email-body">
      <p class="greeting">Hi ${name},</p>
      <p class="email-text">
        We received a request to reset the password for your TaskFlow account. 
        Click the button below to create a new password — this link is valid for <strong>1 hour</strong>.
      </p>
      <div class="cta-wrapper">
        <a href="${resetUrl}" class="cta-btn cta-btn-warning">Reset My Password</a>
      </div>
      <div class="info-box">
        <div class="info-box-label">Expires in</div>
        <div class="info-box-value">1 hour from now</div>
      </div>
      <div class="divider"></div>
      <p class="email-text" style="font-size:0.8125rem;">
        If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
        If you're concerned about your account security, please contact support immediately.
      </p>
      <p class="link-fallback">
        Can't click the button? Copy and paste this URL into your browser:<br/>
        <span style="color:#6366f1;">${resetUrl}</span>
      </p>
    </div>
    <div class="email-footer">
      <p class="footer-text">This link expires in 1 hour for security reasons.</p>
    </div>
  `, `Reset your TaskFlow password — link expires in 1 hour`);
}

export function welcomeEmail(name: string): MailOptions['html'] {
  const appUrl = process.env.CLIENT_URL || `http://localhost:${env.port}`;
  return emailWrapper(`
    <div class="email-hero" style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);">
      <div class="email-hero-icon">🎉</div>
      <h1 class="email-hero-title">Welcome to TaskFlow!</h1>
    </div>
    <div class="email-body">
      <p class="greeting">Hi ${name}, welcome aboard! 🚀</p>
      <p class="email-text">
        Your TaskFlow account has been created successfully. You're now ready to organise your work, 
        collaborate with your team, and ship projects faster.
      </p>
      <div class="stats-row">
        <div class="stat-box">
          <div class="stat-value" style="color:#10b981;">∞</div>
          <div class="stat-label">Tasks & Projects</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color:#6366f1;">⚡</div>
          <div class="stat-label">Real-time Updates</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color:#f59e0b;">📊</div>
          <div class="stat-label">PDF & CSV Reports</div>
        </div>
      </div>
      <div class="cta-wrapper">
        <a href="${appUrl}/dashboard" class="cta-btn cta-btn-success">Get Started →</a>
      </div>
      <div class="divider"></div>
      <p class="email-text" style="font-size:0.875rem;">
        <strong>Quick tips to get started:</strong><br/>
        1. Create your first project<br/>
        2. Add tasks and assign team members<br/>
        3. Track progress in real time
      </p>
    </div>
    <div class="email-footer">
      <p class="footer-text">
        Need help? Check out our <a href="${appUrl}/api-docs" class="footer-link">API docs</a> 
        or visit the <a href="${appUrl}/dashboard" class="footer-link">dashboard</a>.
      </p>
    </div>
  `, `Welcome to TaskFlow, ${name}! Your account is ready.`);
}

export function verificationEmail(name: string, verifyUrl: string): MailOptions['html'] {
  return emailWrapper(`
    <div class="email-hero" style="background:linear-gradient(135deg,#3b82f6 0%,#6366f1 100%);">
      <div class="email-hero-icon">✉️</div>
      <h1 class="email-hero-title">Verify Your Email</h1>
    </div>
    <div class="email-body">
      <p class="greeting">Hi ${name},</p>
      <p class="email-text">
        Thanks for signing up! Please verify your email address to unlock all TaskFlow features. 
        This link is valid for <strong>24 hours</strong>.
      </p>
      <div class="cta-wrapper">
        <a href="${verifyUrl}" class="cta-btn">Verify Email Address</a>
      </div>
      <div class="info-box">
        <div class="info-box-label">Account</div>
        <div class="info-box-value">${name}</div>
      </div>
      <div class="divider"></div>
      <p class="email-text" style="font-size:0.8125rem;">
        If you did not sign up for TaskFlow, you can safely ignore this email.
      </p>
      <p class="link-fallback">
        Or copy and paste this URL:<br/>
        <span style="color:#6366f1;">${verifyUrl}</span>
      </p>
    </div>
    <div class="email-footer">
      <p class="footer-text">This verification link expires in 24 hours.</p>
    </div>
  `, `Verify your TaskFlow email address — link expires in 24 hours`);
}

export function taskAssignedEmail(assigneeName: string, taskTitle: string, projectName: string, taskUrl?: string): MailOptions['html'] {
  const appUrl = process.env.CLIENT_URL || `http://localhost:${env.port}`;
  const url = taskUrl || `${appUrl}/tasks`;
  return emailWrapper(`
    <div class="email-hero" style="background:linear-gradient(135deg,#f59e0b 0%,#ef4444 100%);">
      <div class="email-hero-icon">📋</div>
      <h1 class="email-hero-title">New Task Assigned</h1>
    </div>
    <div class="email-body">
      <p class="greeting">Hi ${assigneeName},</p>
      <p class="email-text">
        You've been assigned a new task. Here are the details:
      </p>
      <div class="info-box">
        <div style="margin-bottom:12px;">
          <div class="info-box-label">Task</div>
          <div class="info-box-value">${taskTitle}</div>
        </div>
        <div>
          <div class="info-box-label">Project</div>
          <div class="info-box-value">${projectName}</div>
        </div>
      </div>
      <div class="cta-wrapper">
        <a href="${url}" class="cta-btn">View Task →</a>
      </div>
    </div>
    <div class="email-footer">
      <p class="footer-text">
        You received this because you were assigned a task in TaskFlow.
      </p>
    </div>
  `, `New task assigned: "${taskTitle}" in ${projectName}`);
}

export function projectMemberAddedEmail(memberName: string, projectName: string, ownerName: string, projectUrl?: string): MailOptions['html'] {
  const appUrl = process.env.CLIENT_URL || `http://localhost:${env.port}`;
  const url = projectUrl || `${appUrl}/projects`;
  return emailWrapper(`
    <div class="email-hero" style="background:linear-gradient(135deg,#8b5cf6 0%,#6366f1 100%);">
      <div class="email-hero-icon">👥</div>
      <h1 class="email-hero-title">Project Invitation</h1>
    </div>
    <div class="email-body">
      <p class="greeting">Hi ${memberName},</p>
      <p class="email-text">
        <strong>${ownerName}</strong> has added you as a member of a project. 
        You can now view, manage, and collaborate on tasks in this project.
      </p>
      <div class="info-box">
        <div class="info-box-label">Project</div>
        <div class="info-box-value">${projectName}</div>
      </div>
      <div class="cta-wrapper">
        <a href="${url}" class="cta-btn">View Project →</a>
      </div>
    </div>
    <div class="email-footer">
      <p class="footer-text">
        You received this because you were added to a TaskFlow project.
      </p>
    </div>
  `, `You've been added to project "${projectName}" by ${ownerName}`);
}

export function commentAddedEmail(
  assigneeName: string,
  commenterName: string,
  taskTitle: string,
  projectName: string,
  taskUrl?: string,
): MailOptions['html'] {
  const appUrl = process.env.CLIENT_URL || `http://localhost:${env.port}`;
  const url = taskUrl || `${appUrl}/tasks`;
  return emailWrapper(`
    <div class="email-hero" style="background:linear-gradient(135deg,#06b6d4 0%,#6366f1 100%);">
      <div class="email-hero-icon">💬</div>
      <h1 class="email-hero-title">New Comment on Your Task</h1>
    </div>
    <div class="email-body">
      <p class="greeting">Hi ${assigneeName},</p>
      <p class="email-text">
        <strong>${commenterName}</strong> left a comment on a task you're assigned to.
      </p>
      <div class="info-box">
        <div style="margin-bottom:12px;">
          <div class="info-box-label">Task</div>
          <div class="info-box-value">${taskTitle}</div>
        </div>
        <div>
          <div class="info-box-label">Project</div>
          <div class="info-box-value">${projectName}</div>
        </div>
      </div>
      <div class="cta-wrapper">
        <a href="${url}" class="cta-btn">View & Reply →</a>
      </div>
    </div>
    <div class="email-footer">
      <p class="footer-text">
        You received this because you are assigned to this task in TaskFlow.
      </p>
    </div>
  `, `${commenterName} commented on "${taskTitle}"`);
}

export function dailyDigestEmail(name: string, overdueCount: number, tasks?: Array<{title: string; dueDate?: Date; priority?: string}>): MailOptions['html'] {
  const appUrl = process.env.CLIENT_URL || `http://localhost:${env.port}`;
  const taskList = tasks && tasks.length > 0 ? tasks.slice(0, 5).map(t => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f3f4f6;">
      <span style="font-size:0.875rem;color:#374151;font-weight:500;">${t.title}</span>
      <span class="priority-badge priority-${t.priority || 'medium'}">${t.priority || 'medium'}</span>
    </div>
  `).join('') : '';

  return emailWrapper(`
    <div class="email-hero" style="background:linear-gradient(135deg,#ef4444 0%,#f97316 100%);">
      <div class="email-hero-icon">⏰</div>
      <h1 class="email-hero-title">Daily Overdue Digest</h1>
    </div>
    <div class="email-body">
      <p class="greeting">Good morning, ${name}!</p>
      <p class="email-text">
        Here's your daily summary. You have tasks that need your attention today.
      </p>
      <div class="stats-row">
        <div class="stat-box">
          <div class="stat-value" style="color:#ef4444;">${overdueCount}</div>
          <div class="stat-label">Overdue Task${overdueCount === 1 ? '' : 's'}</div>
        </div>
      </div>
      ${taskList ? `
      <div style="margin:20px 0;">
        <p style="font-size:0.8125rem;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Overdue Tasks</p>
        ${taskList}
      </div>` : ''}
      <div class="cta-wrapper">
        <a href="${appUrl}/tasks" class="cta-btn" style="background:#ef4444;box-shadow:0 4px 14px rgba(239,68,68,0.35);">Review Overdue Tasks →</a>
      </div>
    </div>
    <div class="email-footer">
      <p class="footer-text">
        This is your daily digest from TaskFlow. 
        <a href="${appUrl}/profile" class="footer-link">Manage notification preferences</a>.
      </p>
    </div>
  `, `You have ${overdueCount} overdue task${overdueCount === 1 ? '' : 's'} — Daily TaskFlow Digest`);
}
