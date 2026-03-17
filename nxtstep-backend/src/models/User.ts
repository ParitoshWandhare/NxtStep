// ============================================================
// NxtStep — User Model (FIXED)
// Added emailVerificationOtp, emailVerificationExpires fields
// ============================================================

import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  rolePreferences: string[];
  resumeUrl?: string;
  resumeText?: string;
  interests: string[];
  isEmailVerified: boolean;
  // ── NEW: OTP fields ──────────────────────────────────────
  emailVerificationOtp?: string;        // hashed 6-digit OTP
  emailVerificationExpires?: Date;      // 10-minute expiry
  // ────────────────────────────────────────────────────────
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  lastLoginAt?: Date;
  loginCount: number;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, minlength: 2, maxlength: 100 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email'],
    },
    passwordHash: { type: String, required: true, select: false },
    rolePreferences: { type: [String], default: [] },
    resumeUrl: { type: String },
    resumeText: { type: String, maxlength: 15000 },
    interests: { type: [String], default: [] },
    isEmailVerified: { type: Boolean, default: false },
    // ── NEW ──────────────────────────────────────────────
    emailVerificationOtp: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    // ─────────────────────────────────────────────────────
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    lastLoginAt: { type: Date },
    loginCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: any) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.emailVerificationOtp;
        delete ret.emailVerificationExpires;
        return ret;
      },
    },
  }
);

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  if (this.passwordHash.startsWith('$2')) return next();
  try {
    this.passwordHash = await bcrypt.hash(this.passwordHash, env.BCRYPT_SALT_ROUNDS);
    next();
  } catch (err) {
    next(err as Error);
  }
});

userSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ passwordResetToken: 1 }, { sparse: true });
userSchema.index({ emailVerificationOtp: 1 }, { sparse: true });
userSchema.index({ createdAt: -1 });

export const User = mongoose.model<IUser>('User', userSchema);