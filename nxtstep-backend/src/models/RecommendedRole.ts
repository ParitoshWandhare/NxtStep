import mongoose, { Document, Schema } from 'mongoose';

export interface IRoleMatch {
  title: string;
  category: string;
  level: string;
  description: string;
  requiredSkills: { name: string; weight: number }[];
  matchScore: number;
  explanation: string[];
  studyResources?: string[];
  interviewTips?: string[];
}

export interface IRecommendedRole extends Document {
  _id: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  roles: IRoleMatch[];
  createdAt: Date;
}

const roleMatchSchema = new Schema<IRoleMatch>({
  title: { type: String, required: true },
  category: { type: String, required: true },
  level: { type: String, required: true },
  description: { type: String, default: '' },
  requiredSkills: [{ name: String, weight: Number }],
  matchScore: { type: Number, min: 0, max: 100, required: true },
  explanation: { type: [String], default: [] },
  studyResources: { type: [String], default: [] },
  interviewTips: { type: [String], default: [] },
});

const recommendedRoleSchema = new Schema<IRecommendedRole>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'InterviewSession',
      required: true,
      unique: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    roles: { type: [roleMatchSchema], default: [] },
  },
  { timestamps: true }
);

export const RecommendedRole = mongoose.model<IRecommendedRole>(
  'RecommendedRole',
  recommendedRoleSchema
);