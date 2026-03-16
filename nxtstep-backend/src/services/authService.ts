// ============================================================
// NxtStep — Auth Service
// ============================================================

import crypto from 'crypto';
import { User } from '../models/User';
import { signToken } from '../utils/jwt';
import { sendPasswordResetEmail, sendWelcomeEmail } from '../utils/email';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { createError } from '../middleware/errorHandler';

export const registerUser = async (
  name: string,
  email: string,
  password: string,
  rolePreferences: string[] = []
) => {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw createError('Email already registered', 409, 'EMAIL_EXISTS');

  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase(),
    passwordHash: password,
    rolePreferences,
  });

  const token = signToken({ userId: user._id.toString(), email: user.email, name: user.name });

  // Fire-and-forget welcome email
  sendWelcomeEmail(user.email, user.name).catch((err) =>
    logger.warn({ err }, 'Welcome email failed')
  );

  logger.info({ userId: user._id }, 'User registered');
  return { token, user: { id: user._id, name: user.name, email: user.email } };
};

export const loginUser = async (email: string, password: string) => {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user) throw createError('Invalid credentials', 401, 'INVALID_CREDENTIALS');

  const valid = await user.comparePassword(password);
  if (!valid) throw createError('Invalid credentials', 401, 'INVALID_CREDENTIALS');

  // Update login stats
  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() }, $inc: { loginCount: 1 } });

  const token = signToken({ userId: user._id.toString(), email: user.email, name: user.name });
  logger.info({ userId: user._id }, 'User logged in');
  return { token, user: { id: user._id, name: user.name, email: user.email } };
};

export const forgotPassword = async (email: string) => {
  const user = await User.findOne({ email: email.toLowerCase() });
  // Always return success to prevent user enumeration
  if (!user) return;

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  await User.updateOne(
    { _id: user._id },
    {
      passwordResetToken: hashedToken,
      passwordResetExpires: new Date(Date.now() + env.PASSWORD_RESET_EXPIRES_HOURS * 60 * 60 * 1000),
    }
  );

  await sendPasswordResetEmail(user.email, rawToken);
  logger.info({ userId: user._id }, 'Password reset email sent');
};

export const resetPassword = async (rawToken: string, newPassword: string) => {
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordHash +passwordResetToken +passwordResetExpires');

  if (!user) throw createError('Invalid or expired reset token', 400, 'INVALID_RESET_TOKEN');

  user.passwordHash = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  logger.info({ userId: user._id }, 'Password reset successfully');
};

export const getProfile = async (userId: string) => {
  const user = await User.findById(userId).select('-passwordHash -passwordResetToken -passwordResetExpires');
  if (!user) throw createError('User not found', 404, 'USER_NOT_FOUND');
  return user;
};

export const updateProfile = async (
  userId: string,
  updates: { name?: string; rolePreferences?: string[]; interests?: string[] }
) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: updates },
    { new: true, runValidators: true }
  ).select('-passwordHash -passwordResetToken -passwordResetExpires');

  if (!user) throw createError('User not found', 404, 'USER_NOT_FOUND');
  logger.info({ userId }, 'Profile updated');
  return user;
};
