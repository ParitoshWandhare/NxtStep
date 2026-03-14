import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';
import { logger } from './logger';

let transporter: Transporter | null = null;

const getTransporter = (): Transporter | null => {
  if (transporter) return transporter;

  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    logger.warn('[Email] SMTP not configured — emails will be logged only');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465, // SSL for port 465, STARTTLS for 587
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: env.NODE_ENV === 'production',
    },
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
  text?: string; // Plain text fallback
}

export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
  const t = getTransporter();

  if (!t) {
    // Dev mode: log email content
    logger.info({
      to: options.to,
      subject: options.subject,
      preview: options.text?.slice(0, 100) ?? '[HTML email]',
    }, '[Email MOCK] Would send email');
    return true;
  }

  try {
    const info = await t.sendMail({
      from: `NxtStep <${env.SMTP_FROM}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    logger.info({ messageId: info.messageId, to: options.to }, 'Email sent');
    return true;
  } catch (err) {
    logger.error({ err, to: options.to, subject: options.subject }, 'Failed to send email');
    return false;
  }
};

export const sendPasswordResetEmail = async (
  to: string,
  resetToken: string,
): Promise<boolean> => {
  const resetUrl = `${env.CLIENT_URL}/reset-password?token=${resetToken}`;

  return sendEmail({
    to,
    subject: 'NxtStep — Reset your password',
    text: `Reset your password: ${resetUrl}\n\nThis link expires in ${env.PASSWORD_RESET_EXPIRES_HOURS} hour(s).`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f7ff; padding: 40px 20px; margin: 0;">
          <div style="max-width: 500px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 20px rgba(0,0,0,0.08);">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="color: #6366f1; font-size: 28px; margin: 0;">NxtStep</h1>
              <p style="color: #64748b; font-size: 13px; margin: 4px 0 0;">AI Interview Platform</p>
            </div>
            <h2 style="color: #1e293b; font-size: 20px; margin: 0 0 12px;">Reset your password</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 24px;">
              We received a request to reset the password for your NxtStep account.
              Click the button below to create a new password. This link expires in
              <strong>${env.PASSWORD_RESET_EXPIRES_HOURS} hour(s)</strong>.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetUrl}"
                 style="background: #6366f1; color: #fff; padding: 14px 32px; border-radius: 8px;
                        text-decoration: none; font-weight: 600; font-size: 15px;
                        display: inline-block;">
                Reset Password
              </a>
            </div>
            <p style="color: #94a3b8; font-size: 13px; margin: 24px 0 0; text-align: center;">
              If you didn't request this, you can safely ignore this email.<br>
              Your password won't change until you click the link above.
            </p>
          </div>
        </body>
      </html>
    `,
  });
};

export const sendWelcomeEmail = async (
  to: string,
  name: string,
): Promise<boolean> => {
  return sendEmail({
    to,
    subject: 'Welcome to NxtStep — Your AI Interview Coach',
    text: `Hi ${name},\n\nWelcome to NxtStep! Start your first AI-powered mock interview at ${env.CLIENT_URL}`,
    html: `
      <!DOCTYPE html>
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f7ff; padding: 40px 20px; margin: 0;">
          <div style="max-width: 500px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 20px rgba(0,0,0,0.08);">
            <h1 style="color: #6366f1;">Welcome to NxtStep, ${name}! 🎉</h1>
            <p style="color: #475569; line-height: 1.6;">
              You're all set to ace your next technical interview with AI-powered practice sessions,
              personalized feedback, and role recommendations tailored to your skills.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${env.CLIENT_URL}/interview/start"
                 style="background: #6366f1; color: #fff; padding: 14px 32px; border-radius: 8px;
                        text-decoration: none; font-weight: 600; font-size: 15px;
                        display: inline-block;">
                Start Your First Interview
              </a>
            </div>
          </div>
        </body>
      </html>
    `,
  });
};