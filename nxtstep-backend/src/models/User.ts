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
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    // This field stores the bcrypt hash — never the plain text password
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      select: false, // Never return in queries by default
    },
    rolePreferences: { type: [String], default: [] },
    resumeUrl: { type: String },
    resumeText: { type: String, maxlength: [15000, 'Resume text too long'] },
    interests: { type: [String], default: [] },
    isEmailVerified: { type: Boolean, default: false },
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

        delete ret.passwordHash;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.__v;

        return ret;
      }
    },
  },
);

// ── Pre-save: hash password ────────────────────────────────────

userSchema.pre('save', async function (next) {
  // Only hash if passwordHash was modified (new user or password change)
  if (!this.isModified('passwordHash')) return next();

  // Skip if already hashed (bcrypt hashes start with $2)
  if (this.passwordHash.startsWith('$2')) return next();

  try {
    this.passwordHash = await bcrypt.hash(
      this.passwordHash,
      env.BCRYPT_SALT_ROUNDS,
    );
    next();
  } catch (err) {
    next(err as Error);
  }
});

// ── Instance method: compare password ─────────────────────────

userSchema.methods.comparePassword = async function (
  password: string,
): Promise<boolean> {
  return bcrypt.compare(password, this.passwordHash);
};

// ── Indexes ───────────────────────────────────────────────────

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ passwordResetToken: 1 }, { sparse: true });
userSchema.index({ createdAt: -1 });

export const User = mongoose.model<IUser>('User', userSchema);