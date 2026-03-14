// ============================================================
// NxtStep — RecommendedRole Model
// Persists the top-N role recommendations for a session.
// One document per session (upserted when computed).
// ============================================================

import mongoose, { Document, Schema } from 'mongoose';

export interface IRoleMatch {
  roleId: string;
  title: string;
  category: string;
  level: string;
  description: string;
  whyMatch: string;
  requiredSkills: { name: string; weight: number }[];
  matchScore: number;          // 0–100
  breakdown: {
    skillMatch: number;        // 0–1
    levelMatch: number;        // 0–1
    preferenceMatch: number;   // 0–1
    resumeMatch: number;       // 0–1
  };
  explanation: string[];       // Human-readable bullets
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
  version: number;             // Incremented on each recompute
}

const breakdownSchema = new Schema(
  {
    skillMatch: { type: Number, default: 0 },
    levelMatch: { type: Number, default: 0 },
    preferenceMatch: { type: Number, default: 0 },
    resumeMatch: { type: Number, default: 0 },
  },
  { _id: false }
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
    salaryRange: {
      min: Number,
      max: Number,
      currency: { type: String, default: 'USD' },
    },
    growthPath: { type: [String], default: [] },
  },
  { _id: false }
);

const recommendedRoleSchema = new Schema<IRecommendedRole>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'InterviewSession',
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    roles: { type: [roleMatchSchema], default: [] },
    computedAt: { type: Date, default: Date.now },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export const RecommendedRole = mongoose.model<IRecommendedRole>(
  'RecommendedRole',
  recommendedRoleSchema
);