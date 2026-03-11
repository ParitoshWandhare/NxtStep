import { v4 as uuidv4 } from 'uuid';
import { InterviewSession, IInterviewSession, IQuestion } from '../models/InterviewSession';
import { signEphemeralToken } from '../utils/jwt';
import {
  generateQuestionQueue,
  evaluateAnswerQueue,
  GenerateQuestionJob,
  EvaluateAnswerJob,
} from '../queues';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { notifyInterviewTerminated } from '../sockets';

// Topic taxonomy per role category
const ROLE_TOPICS: Record<string, string[]> = {
  frontend: ['react', 'javascript', 'css', 'performance', 'accessibility', 'typescript'],
  backend: ['node', 'databases', 'rest-apis', 'auth', 'caching', 'system-design'],
  fullstack: ['react', 'node', 'databases', 'rest-apis', 'javascript', 'system-design'],
  data: ['python', 'sql', 'data-modeling', 'etl', 'statistics', 'ml-basics'],
  ml: ['python', 'ml-algorithms', 'deep-learning', 'data-preprocessing', 'model-evaluation'],
  devops: ['docker', 'kubernetes', 'ci-cd', 'monitoring', 'cloud', 'networking'],
  default: ['problem-solving', 'system-design', 'algorithms', 'communication', 'teamwork'],
};

const getRoleTopics = (role: string): string[] => {
  const key = role.toLowerCase().replace(/\s+/g, '');
  for (const [k, v] of Object.entries(ROLE_TOPICS)) {
    if (key.includes(k)) return v;
  }
  return ROLE_TOPICS.default;
};

export const startInterview = async (params: {
  userId: string;
  role: string;
  difficulty: 'junior' | 'mid' | 'senior';
  preferences?: string[];
}): Promise<{ session: IInterviewSession; ephemeralToken: string }> => {
  const session = await InterviewSession.create({
    userId: params.userId,
    role: params.role,
    difficulty: params.difficulty,
    status: 'in_progress',
  });

  const ephemeralToken = signEphemeralToken({
    sessionId: session._id.toString(),
    userId: params.userId,
    type: 'interview_session',
  });

  session.ephemeralToken = ephemeralToken;
  await session.save();

  // Enqueue first question generation
  const topics = getRoleTopics(params.role);
  const firstTopic = topics[0];

  const job: GenerateQuestionJob = {
    sessionId: session._id.toString(),
    role: params.role,
    level: params.difficulty,
    topic: firstTopic,
    previousQuestions: [],
  };

  await generateQuestionQueue.add('generate-first-question', job, { priority: 1 });
  logger.info(`Interview started: session=${session._id} user=${params.userId} role=${params.role}`);

  return { session, ephemeralToken };
};

export const getSession = async (
  sessionId: string,
  userId: string
): Promise<IInterviewSession> => {
  const session = await InterviewSession.findOne({ _id: sessionId, userId });
  if (!session) throw Object.assign(new Error('Session not found'), { statusCode: 404 });
  return session;
};

export const handleEvent = async (params: {
  sessionId: string;
  userId: string;
  type: string;
  payload: Record<string, unknown>;
}): Promise<{ action: string; data?: unknown }> => {
  const session = await InterviewSession.findOne({ _id: params.sessionId, userId: params.userId });
  if (!session) throw Object.assign(new Error('Session not found'), { statusCode: 404 });
  if (session.status !== 'in_progress') {
    throw Object.assign(new Error('Session is not active'), { statusCode: 400 });
  }

  switch (params.type) {
    case 'answer': {
      return handleAnswerEvent(session, params.payload);
    }
    case 'tab_switch': {
      return handleTabSwitch(session);
    }
    case 'camera_event': {
      return handleCameraEvent(session, params.payload);
    }
    default:
      throw Object.assign(new Error(`Unknown event type: ${params.type}`), { statusCode: 400 });
  }
};

const handleAnswerEvent = async (
  session: IInterviewSession,
  payload: Record<string, unknown>
): Promise<{ action: string; data?: unknown }> => {
  const { questionId, answerText, audioUrl, startTime, endTime } = payload as {
    questionId: string;
    answerText: string;
    audioUrl?: string;
    startTime?: string;
    endTime?: string;
  };

  if (!questionId || !answerText) {
    throw Object.assign(new Error('questionId and answerText are required'), { statusCode: 400 });
  }

  const question = session.questions.find((q) => q.id === questionId);
  if (!question) {
    throw Object.assign(new Error('Question not found in session'), { statusCode: 404 });
  }

  // Store answer
  session.answers.push({
    questionId,
    answerText,
    answerAudioUrl: audioUrl,
    timestamps: {
      start: startTime ? new Date(startTime) : new Date(),
      end: endTime ? new Date(endTime) : new Date(),
    },
  });
  await session.save();

  // Enqueue evaluation
  const evalJob: EvaluateAnswerJob = {
    sessionId: session._id.toString(),
    questionId,
    answerText,
    questionText: question.text,
    expectedKeywords: question.expectedKeywords,
    role: session.role,
    level: session.difficulty,
  };
  await evaluateAnswerQueue.add(`eval-${questionId}`, evalJob);

  logger.info(`Answer received: session=${session._id} question=${questionId}`);
  return { action: 'answer_received', data: { questionId } };
};

const handleTabSwitch = async (
  session: IInterviewSession
): Promise<{ action: string; data?: unknown }> => {
  session.proctoring.tabSwitchCount += 1;
  const count = session.proctoring.tabSwitchCount;

  logger.warn(`Tab switch: session=${session._id} count=${count}`);

  if (count >= env.TAB_SWITCH_TERMINATE_THRESHOLD) {
    await terminateSession(session, 'Too many tab switches');
    return { action: 'terminated', data: { reason: 'Too many tab switches', count } };
  }

  await session.save();

  if (count >= env.TAB_SWITCH_WARN_THRESHOLD) {
    return { action: 'warning', data: { message: 'Warning: Excessive tab switching detected', count } };
  }

  return { action: 'logged', data: { count } };
};

const handleCameraEvent = async (
  session: IInterviewSession,
  payload: Record<string, unknown>
): Promise<{ action: string; data?: unknown }> => {
  const { eventType, details } = payload as { eventType: string; details?: string };

  session.proctoring.cameraEvents.push({
    timestamp: new Date(),
    eventType: eventType as 'face_absent' | 'face_detected' | 'camera_error',
    details,
  });
  await session.save();

  logger.info(`Camera event: session=${session._id} type=${eventType}`);
  return { action: 'camera_event_logged', data: { eventType } };
};

export const triggerNextQuestion = async (
  sessionId: string,
  userId: string
): Promise<{ queued: boolean }> => {
  const session = await InterviewSession.findOne({ _id: sessionId, userId });
  if (!session) throw Object.assign(new Error('Session not found'), { statusCode: 404 });
  if (session.status !== 'in_progress') {
    throw Object.assign(new Error('Session is not active'), { statusCode: 400 });
  }

  const totalMainQuestions = session.questions.filter((q) => !q.parentQuestionId).length;
  if (totalMainQuestions >= env.MAX_QUESTIONS_PER_SESSION) {
    throw Object.assign(new Error('Maximum questions reached — end the interview'), { statusCode: 400 });
  }

  const topics = getRoleTopics(session.role);
  const nextTopicIndex = totalMainQuestions % topics.length;
  const topic = topics[nextTopicIndex];
  const previousQuestions = session.questions.map((q) => q.text);

  session.currentQuestionIndex += 1;
  await session.save();

  await generateQuestionQueue.add('generate-next-question', {
    sessionId: session._id.toString(),
    role: session.role,
    level: session.difficulty,
    topic,
    previousQuestions,
  } as GenerateQuestionJob);

  return { queued: true };
};

export const endInterview = async (
  sessionId: string,
  userId: string
): Promise<{ message: string }> => {
  const session = await InterviewSession.findOne({ _id: sessionId, userId });
  if (!session) throw Object.assign(new Error('Session not found'), { statusCode: 404 });

  if (session.status === 'completed' || session.status === 'terminated') {
    return { message: 'Session already ended' };
  }

  session.status = 'completed';
  await session.save();

  // Enqueue scorecard computation
  const { computeScorecardQueue } = await import('../queues');
  await computeScorecardQueue.add('compute-scorecard', {
    sessionId: session._id.toString(),
    userId,
  });

  logger.info(`Interview ended: session=${session._id}`);
  return { message: 'Interview ended. Scorecard is being computed.' };
};

export const terminateSession = async (
  session: IInterviewSession,
  reason: string
): Promise<void> => {
  session.status = 'terminated';
  session.proctoring.terminated = true;
  session.proctoring.terminationReason = reason;
  await session.save();

  try {
    notifyInterviewTerminated(session._id.toString(), reason);
  } catch {
    // Socket might not be initialized in test environment
  }

  logger.warn(`Interview terminated: session=${session._id} reason=${reason}`);
};

export const addQuestionToSession = async (
  sessionId: string,
  question: IQuestion
): Promise<void> => {
  await InterviewSession.findByIdAndUpdate(sessionId, {
    $push: { questions: question },
  });
};

export const getUserSessions = async (userId: string): Promise<IInterviewSession[]> => {
  return InterviewSession.find({ userId })
    .sort({ createdAt: -1 })
    .select('-questions.expectedKeywords -ephemeralToken')
    .limit(20);
};