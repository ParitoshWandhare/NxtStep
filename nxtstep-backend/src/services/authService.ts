import crypto from 'crypto';
import { User, IUser } from '../models/User';
import { signToken } from '../utils/jwt';
import { sendPasswordResetEmail, sendWelcomeEmail } from '../utils/email';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { createError } from '../middleware/errorHandler';

export interface SignupInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  user: Omit<IUser, 'passwordHash' | 'passwordResetToken' | 'passwordResetExpires'>;
  token: string;
}

// ── Signup ─────────────────────────────────────────────────────

export const signup = async (input: SignupInput): Promise<AuthResult> => {
  const normalizedEmail = input.email.toLowerCase().trim();

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    throw createError('Email already registered', 409);
  }

  const user = await User.create({
    name: input.name.trim(),
    email: normalizedEmail,
    passwordHash: input.password, // Pre-save hook hashes this
  });

  const token = signToken({ userId: user._id.toString(), email: user.email });

  logger.info({ userId: user._id, email: user.email }, 'User registered');

  // Fire-and-forget welcome email
  sendWelcomeEmail(user.email, user.name).catch((err) =>
    logger.warn({ err }, 'Failed to send welcome email'),
  );

  return { user: user.toJSON(), token };
};

// ── Login ──────────────────────────────────────────────────────

export const login = async (input: LoginInput): Promise<AuthResult> => {
  const normalizedEmail = input.email.toLowerCase().trim();

  // MUST use +passwordHash to override the select:false on the field
  const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');

  // Use constant-time comparison logic (always compare even if user not found)
  const dummyHash = '$2a$12$invalidhashfortimingprotection000000000000000';
  const isMatch = user
    ? await user.comparePassword(input.password)
    : await import('bcryptjs').then((b) => b.compare(input.password, dummyHash));

  if (!user || !isMatch) {
    throw createError('Invalid email or password', 401);
  }

  const token = signToken({ userId: user._id.toString(), email: user.email });

  // Update last login (non-blocking)
  User.findByIdAndUpdate(user._id, {
    lastLoginAt: new Date(),
    $inc: { loginCount: 1 },
  }).catch((err) => logger.warn({ err }, 'Failed to update last login'));

  logger.info({ userId: user._id }, 'User logged in');

  return { user: user.toJSON(), token };
};

// ── Forgot password ────────────────────────────────────────────

export const forgotPassword = async (email: string): Promise<void> => {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  // Always return success to prevent email enumeration attacks
  if (!user) {
    logger.debug({ email: normalizedEmail }, 'Password reset requested for unknown email');
    return;
  }

  // Generate a cryptographically secure reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  await User.findByIdAndUpdate(user._id, {
    passwordResetToken: hashedToken,
    passwordResetExpires: new Date(
      Date.now() + env.PASSWORD_RESET_EXPIRES_HOURS * 60 * 60 * 1000,
    ),
  });

  const sent = await sendPasswordResetEmail(user.email, resetToken);
  if (sent) {
    logger.info({ userId: user._id }, 'Password reset email sent');
  } else {
    logger.warn({ userId: user._id }, 'Password reset email failed to send');
  }
};

// ── Reset password ─────────────────────────────────────────────

export const resetPassword = async (
  token: string,
  newPassword: string,
): Promise<void> => {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordHash +passwordResetToken +passwordResetExpires');

  if (!user) {
    throw createError('Reset token is invalid or has expired', 400);
  }

  // Pre-save hook will hash this
  user.passwordHash = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  logger.info({ userId: user._id }, 'Password reset successfully');
};

// ── Get profile ────────────────────────────────────────────────

export const getProfile = async (userId: string): Promise<IUser> => {
  const user = await User.findById(userId);
  if (!user) throw createError('User not found', 404);
  return user;
};

// ── Update profile ─────────────────────────────────────────────

export const updateProfile = async (
  userId: string,
  updates: Partial<
    Pick<IUser, 'name' | 'rolePreferences' | 'interests' | 'resumeUrl' | 'resumeText'>
  >,
): Promise<IUser> => {
  // Sanitize name if provided
  if (updates.name) updates.name = updates.name.trim();

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: updates },
    { new: true, runValidators: true },
  );

  if (!user) throw createError('User not found', 404);

  logger.debug({ userId }, 'User profile updated');
  return user;
};