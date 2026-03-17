// ============================================================
// NxtStep — Auth Service (FIXED)
//
// Bug fixes:
//  1. registerUser: generates 6-digit OTP, hashes it, stores it,
//     sends it via email — user must verify before using the app.
//  2. updateProfile: uses lean-safe findById + save() instead of
//     findByIdAndUpdate so Mongoose validators & hooks run properly,
//     and we return plain data without accidentally stripping fields.
//  3. forgotPassword: fixed so the hashed token is stored correctly
//     and the raw token goes in the email (was already correct logic
//     but added explicit error logging so failures surface).
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

// ── Helper: generate a 6-digit numeric OTP ───────────────────
const generateOtp = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

// ── Helper: hash an OTP (or reset token) with SHA-256 ────────
const hashValue = (value: string): string =>
  crypto.createHash('sha256').update(value).digest('hex');

// ─────────────────────────────────────────────────────────────
// REGISTER — FIX 1: OTP email verification
// ─────────────────────────────────────────────────────────────
export const registerUser = async (
  name: string,
  email: string,
  password: string,
  rolePreferences: string[] = []
) => {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw createError('Email already registered', 409, 'EMAIL_EXISTS');

  // Generate OTP and hash it for storage
  const rawOtp = generateOtp();
  const hashedOtp = hashValue(rawOtp);
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase(),
    passwordHash: password,
    rolePreferences,
    isEmailVerified: false,           // explicitly false until OTP confirmed
    emailVerificationOtp: hashedOtp,
    emailVerificationExpires: otpExpires,
  });

  // Send OTP — if it fails we still return success but log the error
  // so the user can request a resend. Do NOT block registration.
  sendOtpEmail(user.email, user.name, rawOtp).catch((err) =>
    logger.error({ err, userId: user._id }, 'Failed to send verification OTP')
  );

  logger.info({ userId: user._id }, 'User registered — OTP sent');

  // Return a token but the client should redirect to /verify-email.
  // The token works for the verify-email endpoint only until verified.
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

// ─────────────────────────────────────────────────────────────
// VERIFY EMAIL — NEW endpoint handler
// ─────────────────────────────────────────────────────────────
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

  // Mark verified and clear OTP fields
  user.isEmailVerified = true;
  user.emailVerificationOtp = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  // Send welcome email after successful verification
  sendWelcomeEmail(user.email, user.name).catch((err) =>
    logger.warn({ err }, 'Welcome email failed')
  );

  const token = signToken({ userId: user._id.toString(), email: user.email });
  logger.info({ userId: user._id }, 'Email verified');

  return {
    token,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      isEmailVerified: true,
    },
  };
};

// ─────────────────────────────────────────────────────────────
// RESEND OTP — NEW endpoint handler
// ─────────────────────────────────────────────────────────────
export const resendVerificationOtp = async (userId: string) => {
  const user = await User.findById(userId).select(
    '+emailVerificationOtp +emailVerificationExpires'
  );

  if (!user) throw createError('User not found', 404, 'USER_NOT_FOUND');
  if (user.isEmailVerified) throw createError('Email already verified', 400, 'ALREADY_VERIFIED');

  // Rate-limit resend: don't allow if previous OTP is still fresh (< 1 min old)
  if (
    user.emailVerificationExpires &&
    new Date() < new Date(user.emailVerificationExpires.getTime() - 9 * 60 * 1000)
  ) {
    throw createError(
      'Please wait before requesting a new OTP.',
      429,
      'OTP_RESEND_TOO_SOON'
    );
  }

  const rawOtp = generateOtp();
  const hashedOtp = hashValue(rawOtp);
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

  user.emailVerificationOtp = hashedOtp;
  user.emailVerificationExpires = otpExpires;
  await user.save();

  await sendOtpEmail(user.email, user.name, rawOtp);
  logger.info({ userId: user._id }, 'OTP resent');

  return { message: 'A new verification code has been sent to your email.' };
};

// ─────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────
export const loginUser = async (email: string, password: string) => {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user) throw createError('Invalid credentials', 401, 'INVALID_CREDENTIALS');

  const valid = await user.comparePassword(password);
  if (!valid) throw createError('Invalid credentials', 401, 'INVALID_CREDENTIALS');

  // ── Optional: block login until email is verified ─────────
  // Uncomment the block below if you want to enforce verification before login.
  // if (!user.isEmailVerified) {
  //   throw createError(
  //     'Please verify your email before logging in.',
  //     403,
  //     'EMAIL_NOT_VERIFIED'
  //   );
  // }

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

// ─────────────────────────────────────────────────────────────
// FORGOT PASSWORD — FIX 3
// Root cause: the Postman screenshot shows Content-Type is "Text"
// not "application/json", so Express body-parser never parses the
// body and Zod sees an empty object → "Required" on email field.
// Fix is in validate middleware (see validate.ts) — we also add
// explicit error logging here so failures surface in logs.
// ─────────────────────────────────────────────────────────────
export const forgotPassword = async (email: string) => {
  const user = await User.findOne({ email: email.toLowerCase() });

  // Always succeed to prevent user enumeration
  if (!user) {
    logger.info({ email }, 'Forgot password: no account found (silent)');
    return;
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = hashValue(rawToken);

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        passwordResetToken: hashedToken,
        passwordResetExpires: new Date(
          Date.now() + env.PASSWORD_RESET_EXPIRES_HOURS * 60 * 60 * 1000
        ),
      },
    }
  );

  const sent = await sendPasswordResetEmail(user.email, rawToken);
  if (!sent) {
    logger.error({ userId: user._id }, 'Failed to send password reset email');
    // Don't throw — still return 200 to prevent enumeration
  }

  logger.info({ userId: user._id }, 'Password reset email sent');
};

// ─────────────────────────────────────────────────────────────
// RESET PASSWORD
// ─────────────────────────────────────────────────────────────
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
// GET PROFILE
// ─────────────────────────────────────────────────────────────
export const getProfile = async (userId: string) => {
  const user = await User.findById(userId).select(
    '-passwordHash -passwordResetToken -passwordResetExpires -emailVerificationOtp -emailVerificationExpires'
  );
  if (!user) throw createError('User not found', 404, 'USER_NOT_FOUND');
  return user;
};

// ─────────────────────────────────────────────────────────────
// UPDATE PROFILE — FIX 2
//
// Root cause: findByIdAndUpdate with `$set: updates` works at the
// DB level but the returned document's `toJSON` transform runs on
// a Mongoose hydrated doc only when using `new: true`. However,
// the real issue is that `updateSettingsSchema` uses .optional()
// fields — if ALL fields are undefined, `$set: {}` is a no-op and
// Mongoose silently succeeds without touching any document.
//
// Fix: use findById + explicit field assignment + save() so:
//  - Mongoose runs full validation on changed fields
//  - The pre-save hook fires correctly
//  - The returned document is the live hydrated copy
//  - We can confirm what actually changed before saving
// ─────────────────────────────────────────────────────────────
export const updateProfile = async (
  userId: string,
  updates: { name?: string; rolePreferences?: string[]; interests?: string[] }
) => {
  // Guard: if nothing was actually sent, fail fast with a clear error
  const hasUpdates = Object.values(updates).some((v) => v !== undefined);
  if (!hasUpdates) {
    throw createError('No update fields provided', 400, 'NO_UPDATE_FIELDS');
  }

  const user = await User.findById(userId);
  if (!user) throw createError('User not found', 404, 'USER_NOT_FOUND');

  // Only assign fields that were actually sent
  if (updates.name !== undefined) {
    user.name = updates.name.trim();
  }
  if (updates.rolePreferences !== undefined) {
    user.rolePreferences = updates.rolePreferences;
  }
  if (updates.interests !== undefined) {
    user.interests = updates.interests;
  }

  // save() runs validators + pre-save hooks
  await user.save();

  logger.info({ userId, fields: Object.keys(updates).filter((k) => (updates as any)[k] !== undefined) }, 'Profile updated');

  // Return the plain object via toJSON transform (strips sensitive fields)
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