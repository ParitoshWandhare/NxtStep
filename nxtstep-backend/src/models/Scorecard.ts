import mongoose, { Document, Schema } from 'mongoose';

export interface IScorecard extends Document {
  _id: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  technical: number;
  problemSolving: number;
  communication: number;
  confidence: number;
  conceptDepth: number;
  overall: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  questionsEvaluated: number;
  createdAt: Date;
  updatedAt: Date;
}

const scorecardSchema = new Schema<IScorecard>(
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
    technical:      { type: Number, min: 0, max: 10, default: 0 },
    problemSolving: { type: Number, min: 0, max: 10, default: 0 },
    communication:  { type: Number, min: 0, max: 10, default: 0 },
    confidence:     { type: Number, min: 0, max: 10, default: 0 },
    conceptDepth:   { type: Number, min: 0, max: 10, default: 0 },
    overall:        { type: Number, min: 0, max: 10, default: 0 },
    strengths:      { type: [String], default: [] },
    weaknesses:     { type: [String], default: [] },
    suggestions:    { type: [String], default: [] },
    questionsEvaluated: { type: Number, default: 0 },
  },
  { timestamps: true },
);

scorecardSchema.index({ userId: 1, createdAt: -1 });

export const Scorecard = mongoose.model<IScorecard>('Scorecard', scorecardSchema);