import mongoose, { Document, Schema } from 'mongoose';

export type SessionStatus = 'pending' | 'in_progress' | 'completed' | 'terminated';
export type QuestionType = 'concept' | 'problem' | 'behavioral';
export type CameraEventType = 'face_absent' | 'face_detected' | 'camera_error';
export type ProctoringEventType = 'tab_switch' | 'window_blur' | 'window_focus' | CameraEventType;

export interface IQuestion {
  id: string;
  text: string;
  type: QuestionType;
  topic: string;
  difficulty: string;
  expectedKeywords: string[];
  followUpCount: number;
  parentQuestionId?: string;
}

export interface IAnswer {
  questionId: string;
  answerText: string;
  answerAudioUrl?: string;
  timestamps: { start: Date; end: Date };
  evaluationId?: mongoose.Types.ObjectId;
}

export interface ICameraEvent {
  timestamp: Date;
  eventType: CameraEventType;
  details?: string;
}

export interface IProctoringData {
  tabSwitchCount: number;
  cameraEvents: ICameraEvent[];
  terminated: boolean;
  terminationReason?: string;
}

export interface IInterviewSession extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: string;
  difficulty: 'junior' | 'mid' | 'senior';
  questions: IQuestion[];
  answers: IAnswer[];
  proctoring: IProctoringData;
  scorecardId?: mongoose.Types.ObjectId;
  status: SessionStatus;
  currentQuestionIndex: number;
  ephemeralToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

const questionSchema = new Schema<IQuestion>({
  id: { type: String, required: true },
  text: { type: String, required: true },
  type: { type: String, enum: ['concept', 'problem', 'behavioral'], required: true },
  topic: { type: String, default: 'general' },
  difficulty: { type: String, default: 'mid' },
  expectedKeywords: { type: [String], default: [] },
  followUpCount: { type: Number, default: 0 },
  parentQuestionId: { type: String },
});

const answerSchema = new Schema<IAnswer>({
  questionId: { type: String, required: true },
  answerText: { type: String, default: '' },
  answerAudioUrl: { type: String },
  timestamps: {
    start: { type: Date, required: true },
    end: { type: Date, required: true },
  },
  evaluationId: { type: Schema.Types.ObjectId, ref: 'Evaluation' },
});

const cameraEventSchema = new Schema<ICameraEvent>({
  timestamp: { type: Date, required: true },
  eventType: { type: String, required: true },
  details: { type: String },
});

const interviewSessionSchema = new Schema<IInterviewSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, required: true },
    difficulty: { type: String, enum: ['junior', 'mid', 'senior'], default: 'mid' },
    questions: { type: [questionSchema], default: [] },
    answers: { type: [answerSchema], default: [] },
    engineState: { type: String }, // JSON string of EngineSession for persistence
    proctoring: {
      tabSwitchCount: { type: Number, default: 0 },
      cameraEvents: { type: [cameraEventSchema], default: [] },
      terminated: { type: Boolean, default: false },
      terminationReason: { type: String },
    },
    scorecardId: { type: Schema.Types.ObjectId, ref: 'Scorecard' },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'terminated'],
      default: 'pending',
      index: true,
    },
    currentQuestionIndex: { type: Number, default: 0 },
    ephemeralToken: { type: String },
  },
  { timestamps: true }
);

export const InterviewSession = mongoose.model<IInterviewSession>(
  'InterviewSession',
  interviewSessionSchema
);