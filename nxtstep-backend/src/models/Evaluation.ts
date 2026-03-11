import mongoose, { Document, Schema } from 'mongoose';

export interface IScores {
  technical: number;
  communication: number;
  problemSolving: number;
  confidence: number;
  conceptDepth: number;
}

export interface IEvaluation extends Document {
  _id: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  questionId: string;
  answerText: string;
  scores: IScores;
  detectedKeywords: string[];
  missingKeywords: string[];
  feedback: {
    strengths: string[];
    weaknesses: string[];
    improvements: string[];
  };
  followUp: {
    shouldAsk: boolean;
    reason: string;
  };
  promptHash?: string;
  modelUsed?: string;
  createdAt: Date;
}

const scoresSchema = new Schema<IScores>({
  technical: { type: Number, min: 0, max: 10, required: true },
  communication: { type: Number, min: 0, max: 10, required: true },
  problemSolving: { type: Number, min: 0, max: 10, required: true },
  confidence: { type: Number, min: 0, max: 10, required: true },
  conceptDepth: { type: Number, min: 0, max: 10, required: true },
});

const evaluationSchema = new Schema<IEvaluation>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'InterviewSession', required: true, index: true },
    questionId: { type: String, required: true },
    answerText: { type: String, required: true },
    scores: { type: scoresSchema, required: true },
    detectedKeywords: { type: [String], default: [] },
    missingKeywords: { type: [String], default: [] },
    feedback: {
      strengths: { type: [String], default: [] },
      weaknesses: { type: [String], default: [] },
      improvements: { type: [String], default: [] },
    },
    followUp: {
      shouldAsk: { type: Boolean, default: false },
      reason: { type: String, default: '' },
    },
    promptHash: { type: String },
    modelUsed: { type: String },
  },
  { timestamps: true }
);

export const Evaluation = mongoose.model<IEvaluation>('Evaluation', evaluationSchema);