import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash?: string;
  rolePreferences: string[];
  resumeUrl?: string;
  resumeText?: string;
  interests: string[];
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    rolePreferences: { type: [String], default: [] },
    resumeUrl: { type: String },
    resumeText: { type: String },
    interests: { type: [String], default: [] },
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  // passwordHash field stores plain text before save — we hash here
  this.passwordHash = await bcrypt.hash(this.passwordHash as string, 12);
  next();
});

userSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.passwordHash);
};

// Don't return passwordHash in JSON responses
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    return ret;
  },
});

export const User = mongoose.model<IUser>('User', userSchema);