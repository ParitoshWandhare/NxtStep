// ============================================================
// NxtStep — Email Utility
// Nodemailer with graceful fallback to console logging in dev.
// ============================================================

import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';
import { logger } from './logger';

let transporter: Transporter | null = null;

const getTransporter = (): Transporter | null => {
  if (transporter) return transporter;
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    logger.warn('[Email] SMTP not configured — emails logged only');
    return null;
  }
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    tls: { rejectUnauthorized: env.NODE_ENV === 'production' },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });
  return transporter;
};

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
  const t = getTransporter();
  if (!t) {
    logger.info({ to: options.to, subject: options.subject }, '[Email MOCK] Would send email');
    return true;
  }
  try {
    const info = await t.sendMail({ from: `NxtStep <${env.SMTP_FROM}>`, ...options });
    logger.info({ messageId: info.messageId, to: options.to }, 'Email sent');
    return true;
  } catch (err) {
    logger.error({ err, to: options.to }, 'Failed to send email');
    return false;
  }
};

export const sendPasswordResetEmail = async (to: string, resetToken: string): Promise<boolean> => {
  const resetUrl = `${env.CLIENT_URL}/reset-password?token=${resetToken}`;
  return sendEmail({
    to,
    subject: 'NxtStep — Reset your password',
    text: `Reset your password: ${resetUrl}\n\nThis link expires in ${env.PASSWORD_RESET_EXPIRES_HOURS} hour(s).`,
    html: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f4f7ff;padding:40px 20px;margin:0">
<div style="max-width:500px;margin:0 auto;background:#fff;border-radius:12px;padding:40px;box-shadow:0 2px 20px rgba(0,0,0,.08)">
  <h1 style="color:#6366f1">NxtStep</h1>
  <h2 style="color:#1e293b">Reset your password</h2>
  <p style="color:#475569;line-height:1.6">Click below to reset your password. Link expires in <strong>${env.PASSWORD_RESET_EXPIRES_HOURS} hour(s)</strong>.</p>
  <div style="text-align:center;margin:32px 0">
    <a href="${resetUrl}" style="background:#6366f1;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">Reset Password</a>
  </div>
  <p style="color:#94a3b8;font-size:13px;text-align:center">If you didn't request this, ignore this email.</p>
</div></body></html>`,
  });
};

export const sendWelcomeEmail = async (to: string, name: string): Promise<boolean> => {
  return sendEmail({
    to,
    subject: 'Welcome to NxtStep — Your AI Interview Coach',
    text: `Hi ${name},\n\nWelcome to NxtStep! Start your first AI-powered interview at ${env.CLIENT_URL}`,
    html: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f4f7ff;padding:40px 20px;margin:0">
<div style="max-width:500px;margin:0 auto;background:#fff;border-radius:12px;padding:40px;box-shadow:0 2px 20px rgba(0,0,0,.08)">
  <h1 style="color:#6366f1">Welcome to NxtStep, ${name}! 🎉</h1>
  <p style="color:#475569;line-height:1.6">You're all set! Practice AI-powered interviews, get personalized feedback, and discover your best career matches.</p>
  <div style="text-align:center;margin:32px 0">
    <a href="${env.CLIENT_URL}/interview/start" style="background:#6366f1;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">Start Your First Interview</a>
  </div>
</div></body></html>`,
  });
};
