// ============================================================
// NxtStep — RoleFeedback Model
// Stores user feedback on recommended roles.
// Drives the feedback loop that tunes weights over time.
// ============================================================

import mongoose, { Document, Schema } from 'mongoose';

export type FeedbackSignal = 'relevant' | 'not_relevant' | 'applied' | 'saved';

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
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'InterviewSession',
      required: true,
      index: true,
    },
    roleTitle: { type: String, required: true },
    roleCategory: { type: String, required: true },
    roleLevel: { type: String, required: true },
    signal: {
      type: String,
      enum: ['relevant', 'not_relevant', 'applied', 'saved'],
      required: true,
    },
    matchScore: { type: Number, min: 0, max: 100 },
  },
  { timestamps: true }
);

roleFeedbackSchema.index({ userId: 1, sessionId: 1, roleTitle: 1 }, { unique: true });
roleFeedbackSchema.index({ roleCategory: 1, signal: 1 });

export const RoleFeedback = mongoose.model<IRoleFeedback>('RoleFeedback', roleFeedbackSchema);