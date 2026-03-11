import crypto from 'crypto';
import { User, IUser } from '../models/User';
import { signToken } from '../utils/jwt';
import { sendPasswordResetEmail } from '../utils/email';
import { logger } from '../utils/logger';

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
  user: Partial<IUser>;
  token: string;
}

export const signup = async (input: SignupInput): Promise<AuthResult> => {
  const existing = await User.findOne({ email: input.email.toLowerCase() });
  if (existing) {
    throw Object.assign(new Error('Email already registered'), { statusCode: 409 });
  }

  const user = await User.create({
    name: input.name,
    email: input.email.toLowerCase(),
    passwordHash: input.password, // pre-save hook will hash this
  });

  const token = signToken({ userId: user._id.toString(), email: user.email });
  logger.info(`New user registered: ${user.email}`);

  return { user: user.toJSON(), token };
};

export const login = async (input: LoginInput): Promise<AuthResult> => {
  const user = await User.findOne({ email: input.email.toLowerCase() });
  if (!user) {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }

  const isMatch = await user.comparePassword(input.password);
  if (!isMatch) {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }

  const token = signToken({ userId: user._id.toString(), email: user.email });
  logger.info(`User logged in: ${user.email}`);

  return { user: user.toJSON(), token };
};

export const forgotPassword = async (email: string): Promise<void> => {
  const user = await User.findOne({ email: email.toLowerCase() });
  // Always return success to avoid email enumeration
  if (!user) return;

  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  user.passwordResetToken = hashedToken;
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await user.save({ validateBeforeSave: false });

  await sendPasswordResetEmail(user.email, resetToken);
  logger.info(`Password reset email sent to: ${user.email}`);
};

export const resetPassword = async (token: string, newPassword: string): Promise<void> => {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: new Date() },
  });

  if (!user) {
    throw Object.assign(new Error('Invalid or expired reset token'), { statusCode: 400 });
  }

  user.passwordHash = newPassword; // pre-save hook will hash
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  logger.info(`Password reset successful for: ${user.email}`);
};

export const getProfile = async (userId: string): Promise<Partial<IUser>> => {
  const user = await User.findById(userId).select('-passwordHash -passwordResetToken -passwordResetExpires');
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  return user.toJSON();
};

export const updateProfile = async (
  userId: string,
  updates: Partial<Pick<IUser, 'name' | 'rolePreferences' | 'interests' | 'resumeUrl' | 'resumeText'>>
): Promise<Partial<IUser>> => {
  const user = await User.findByIdAndUpdate(userId, updates, { new: true, runValidators: true })
    .select('-passwordHash -passwordResetToken -passwordResetExpires');
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  return user.toJSON();
};