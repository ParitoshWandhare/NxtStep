import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from './logger';

const createTransporter = () => {
  if (!env.SMTP_HOST) {
    logger.warn('SMTP not configured — emails will be logged only');
    return null;
  }
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
};

export const sendEmail = async (options: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> => {
  const transporter = createTransporter();
  if (!transporter) {
    logger.info(`[EMAIL MOCK] To: ${options.to} | Subject: ${options.subject}`);
    return;
  }
  await transporter.sendMail({
    from: env.SMTP_FROM,
    ...options,
  });
};

export const sendPasswordResetEmail = async (to: string, resetToken: string): Promise<void> => {
  const resetUrl = `${env.CLIENT_URL}/reset-password?token=${resetToken}`;
  await sendEmail({
    to,
    subject: 'NxtStep — Reset your password',
    html: `
      <h2>Password Reset</h2>
      <p>Click the link below to reset your password. This link expires in 1 hour.</p>
      <a href="${resetUrl}" style="background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">
        Reset Password
      </a>
      <p>If you didn't request this, please ignore this email.</p>
    `,
  });
};