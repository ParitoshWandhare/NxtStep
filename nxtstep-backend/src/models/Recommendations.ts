// ============================================================
// NxtStep — RecommendedRole & RoleFeedback Models
// ============================================================

import mongoose, { Document, Schema } from 'mongoose';

export type FeedbackSignal = 'relevant' | 'not_relevant' | 'applied' | 'saved';

// ─── RecommendedRole ──────────────────────────────────────────

export interface IRoleMatch {
  roleId: string;
  title: string;
  category: string;
  level: string;
  description: string;
  whyMatch: string;
  requiredSkills: { name: string; weight: number }[];
  matchScore: number;
  breakdown: {
    skillMatch: number;
    levelMatch: number;
    preferenceMatch: number;
    resumeMatch: number;
  };
  explanation: string[];
  studyResources: string[];
  interviewTips: string[];
  salaryRange?: { min: number; max: number; currency: string };
  growthPath: string[];
}

export interface IRecommendedRole extends Document {
  _id: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  roles: IRoleMatch[];
  computedAt: Date;
  version: number;
}

const breakdownSchema = new Schema(
  {
    skillMatch: { type: Number, default: 0 },
    levelMatch: { type: Number, default: 0 },
    preferenceMatch: { type: Number, default: 0 },
    resumeMatch: { type: Number, default: 0 },
  },
  { _id: false },
);

const roleMatchSchema = new Schema<IRoleMatch>(
  {
    roleId: { type: String, required: true },
    title: { type: String, required: true },
    category: { type: String, required: true },
    level: { type: String, required: true },
    description: { type: String, default: '' },
    whyMatch: { type: String, default: '' },
    requiredSkills: [{ name: String, weight: Number }],
    matchScore: { type: Number, min: 0, max: 100, required: true },
    breakdown: { type: breakdownSchema, default: () => ({}) },
    explanation: { type: [String], default: [] },
    studyResources: { type: [String], default: [] },
    interviewTips: { type: [String], default: [] },
    salaryRange: { min: Number, max: Number, currency: { type: String, default: 'USD' } },
    growthPath: { type: [String], default: [] },
  },
  { _id: false },
);

const recommendedRoleSchema = new Schema<IRecommendedRole>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'InterviewSession', required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    roles: { type: [roleMatchSchema], default: [] },
    computedAt: { type: Date, default: Date.now },
    version: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export const RecommendedRole = mongoose.model<IRecommendedRole>('RecommendedRole', recommendedRoleSchema);

// ─── RoleFeedback ─────────────────────────────────────────────

export interface IRoleFeedback extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  roleTitle: string;
  roleCategory: string;
  roleLevel: string;
  signal: FeedbackSignal;
  matchScore: number;
  createdAt: Date;
}

const roleFeedbackSchema = new Schema<IRoleFeedback>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'InterviewSession', required: true, index: true },
    roleTitle: { type: String, required: true },
    roleCategory: { type: String, required: true },
    roleLevel: { type: String, required: true },
    signal: { type: String, enum: ['relevant', 'not_relevant', 'applied', 'saved'], required: true },
    matchScore: { type: Number, min: 0, max: 100 },
  },
  { timestamps: true },
);

roleFeedbackSchema.index({ userId: 1, sessionId: 1, roleTitle: 1 }, { unique: true });
roleFeedbackSchema.index({ roleCategory: 1, signal: 1 });

export const RoleFeedback = mongoose.model<IRoleFeedback>('RoleFeedback', roleFeedbackSchema);
