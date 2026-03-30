// ============================================================
// NxtStep — Auth Service (Updated getProfile)
// FIX: getProfile now returns loginCount, lastLoginAt, createdAt
//      by explicitly selecting those fields from DB
// ============================================================

import crypto from 'crypto';
import { User } from '../models/User';
import { signToken } from '../utils/jwt';
import {
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendOtpEmail,
} from '../utils/email';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { createError } from '../middleware/errorHandler';

const generateOtp = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

const hashValue = (value: string): string =>
  crypto.createHash('sha256').update(value).digest('hex');

export const registerUser = async (
  name: string,
  email: string,
  password: string,
  rolePreferences: string[] = []
) => {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw createError('Email already registered', 409, 'EMAIL_EXISTS');

  const rawOtp = generateOtp();
  const hashedOtp = hashValue(rawOtp);
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase(),
    passwordHash: password,
    rolePreferences,
    isEmailVerified: false,
    emailVerificationOtp: hashedOtp,
    emailVerificationExpires: otpExpires,
  });

  sendOtpEmail(user.email, user.name, rawOtp).catch(err =>
    logger.error({ err, userId: user._id }, 'Failed to send verification OTP')
  );

  logger.info({ userId: user._id }, 'User registered — OTP sent');

  const token = signToken({ userId: user._id.toString(), email: user.email });
  return {
    token,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      isEmailVerified: false,
    },
    message: 'Account created. Please check your email for the verification code.',
  };
};

export const verifyEmail = async (userId: string, otp: string) => {
  const user = await User.findById(userId).select(
    '+emailVerificationOtp +emailVerificationExpires'
  );
  if (!user) throw createError('User not found', 404, 'USER_NOT_FOUND');
  if (user.isEmailVerified) throw createError('Email already verified', 400, 'ALREADY_VERIFIED');
  if (!user.emailVerificationOtp || !user.emailVerificationExpires) {
    throw createError('No pending verification. Please request a new OTP.', 400, 'NO_OTP');
  }
  if (new Date() > user.emailVerificationExpires) {
    throw createError('OTP has expired. Please request a new one.', 400, 'OTP_EXPIRED');
  }
  const hashedInput = hashValue(otp.trim());
  if (hashedInput !== user.emailVerificationOtp) {
    throw createError('Invalid OTP. Please try again.', 400, 'INVALID_OTP');
  }
  user.isEmailVerified = true;
  user.emailVerificationOtp = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();
  sendWelcomeEmail(user.email, user.name).catch(err => logger.warn({ err }, 'Welcome email failed'));
  const token = signToken({ userId: user._id.toString(), email: user.email });
  logger.info({ userId: user._id }, 'Email verified');
  return { token, user: { id: user._id.toString(), name: user.name, email: user.email, isEmailVerified: true } };
};

export const resendVerificationOtp = async (userId: string) => {
  const user = await User.findById(userId).select('+emailVerificationOtp +emailVerificationExpires');
  if (!user) throw createError('User not found', 404, 'USER_NOT_FOUND');
  if (user.isEmailVerified) throw createError('Email already verified', 400, 'ALREADY_VERIFIED');
  if (user.emailVerificationExpires && new Date() < new Date(user.emailVerificationExpires.getTime() - 9 * 60 * 1000)) {
    throw createError('Please wait before requesting a new OTP.', 429, 'OTP_RESEND_TOO_SOON');
  }
  const rawOtp = generateOtp();
  user.emailVerificationOtp = hashValue(rawOtp);
  user.emailVerificationExpires = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();
  await sendOtpEmail(user.email, user.name, rawOtp);
  logger.info({ userId: user._id }, 'OTP resent');
  return { message: 'A new verification code has been sent to your email.' };
};

export const loginUser = async (email: string, password: string) => {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user) throw createError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  const valid = await user.comparePassword(password);
  if (!valid) throw createError('Invalid credentials', 401, 'INVALID_CREDENTIALS');

  await User.updateOne(
    { _id: user._id },
    { $set: { lastLoginAt: new Date() }, $inc: { loginCount: 1 } }
  );

  const token = signToken({ userId: user._id.toString(), email: user.email });
  logger.info({ userId: user._id }, 'User logged in');
  return {
    token,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      isEmailVerified: user.isEmailVerified,
    },
  };
};

export const forgotPassword = async (email: string) => {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) { logger.info({ email }, 'Forgot password: no account found (silent)'); return; }
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = hashValue(rawToken);
  await User.updateOne({ _id: user._id }, {
    $set: {
      passwordResetToken: hashedToken,
      passwordResetExpires: new Date(Date.now() + env.PASSWORD_RESET_EXPIRES_HOURS * 60 * 60 * 1000),
    },
  });
  const sent = await sendPasswordResetEmail(user.email, rawToken);
  if (!sent) logger.error({ userId: user._id }, 'Failed to send password reset email');
  logger.info({ userId: user._id }, 'Password reset email sent');
};

export const resetPassword = async (rawToken: string, newPassword: string) => {
  const hashedToken = hashValue(rawToken);
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

// ─────────────────────────────────────────────────────────────
// GET PROFILE — FIX: explicitly include loginCount, lastLoginAt, createdAt
// The Mongoose schema has loginCount with default: 0 and lastLoginAt as optional.
// We must NOT exclude them. Using a explicit projection to guarantee they appear.
// ─────────────────────────────────────────────────────────────
export const getProfile = async (userId: string) => {
  const user = await User.findById(userId)
    .select(
      // Explicitly include all public fields we want returned
      'name email rolePreferences resumeUrl resumeText interests isEmailVerified loginCount lastLoginAt createdAt updatedAt'
    )
    .lean();

  if (!user) throw createError('User not found', 404, 'USER_NOT_FOUND');

  // Return a clean object that maps _id to id for frontend consistency
  return {
    id: (user._id as any).toString(),
    name: user.name,
    email: user.email,
    isEmailVerified: user.isEmailVerified,
    rolePreferences: user.rolePreferences || [],
    interests: user.interests || [],
    resumeUrl: user.resumeUrl,
    // Explicitly include these — frontend needs them for Profile page display
    loginCount: user.loginCount ?? 0,
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

// ─────────────────────────────────────────────────────────────
// UPDATE PROFILE
// ─────────────────────────────────────────────────────────────
export const updateProfile = async (
  userId: string,
  updates: { name?: string; rolePreferences?: string[]; interests?: string[] }
) => {
  const hasUpdates = Object.values(updates).some(v => v !== undefined);
  if (!hasUpdates) throw createError('No update fields provided', 400, 'NO_UPDATE_FIELDS');

  const user = await User.findById(userId);
  if (!user) throw createError('User not found', 404, 'USER_NOT_FOUND');

  if (updates.name !== undefined) user.name = updates.name.trim();
  if (updates.rolePreferences !== undefined) user.rolePreferences = updates.rolePreferences;
  if (updates.interests !== undefined) user.interests = updates.interests;

  await user.save();
  logger.info({ userId, fields: Object.keys(updates).filter(k => (updates as any)[k] !== undefined) }, 'Profile updated');

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    rolePreferences: user.rolePreferences,
    interests: user.interests,
    isEmailVerified: user.isEmailVerified,
    loginCount: user.loginCount,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};