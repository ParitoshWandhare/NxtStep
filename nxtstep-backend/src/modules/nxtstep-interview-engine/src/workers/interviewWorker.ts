// ============================================================
// NxtStep Interview Engine — Interview Worker (BullMQ)
// Processes: evaluateAnswer, generateQuestion, generateFollowUp,
//            computeScorecard
// Notifies clients via Socket.IO after each job.
// ============================================================

import { Job, Worker } from 'bullmq';
import { Server as SocketServer } from 'socket.io';
import { evaluateAnswer } from '../services/answerEvaluator';
import { generateFollowUp, generateQuestion } from '../services/questionGenerator';
import { computeScorecard } from '../services/scoringAggregator';
import {
  ComputeScorecardJob,
  EvaluateAnswerJob,
  GenerateFollowUpJob,
  GenerateQuestionJob,
} from '../types/interview.types';
import {
  enqueueComputeScorecard,
  enqueueGenerateFollowUp,
  QUEUE_NAMES,
  redisConnection,
} from '../queues/index';

// ─── In-memory session store (replace with MongoDB in production) ─

import { sessionStore } from '../services/sessionStore';

// ─── Worker factory ───────────────────────────────────────────

export function createInterviewWorkers(io: SocketServer): Worker[] {
  const workers: Worker[] = [];

  // ── 1. Evaluate Answer ───────────────────────────────────────
  const evaluateWorker = new Worker<EvaluateAnswerJob>(
    QUEUE_NAMES.EVALUATE_ANSWER,
    async (job: Job<EvaluateAnswerJob>) => {
      const { sessionId, questionId, answerText } = job.data;
      console.log(`[Worker:evaluateAnswer] Processing ${job.id} for session ${sessionId}`);

      const session = await sessionStore.get(sessionId);
      if (!session) throw new Error(`Session ${sessionId} not found`);

      const question = session.questions.find(q => q.id === questionId);
      if (!question) throw new Error(`Question ${questionId} not found`);

      // Run evaluation
      const evaluation = await evaluateAnswer({ sessionId, question, answerText });

      // Persist evaluation
      session.evaluations.push(evaluation);
      await sessionStore.save(session);

      // Decide on follow-up
      if (evaluation.followUp.shouldAsk) {
        await enqueueGenerateFollowUp({
          sessionId,
          questionId,
          originalQuestion: question.text,
          candidateAnswer:  answerText,
          missingKeywords:  evaluation.followUp.missingKeywords,
        });
        // Increment follow-up counter on the question
        question.followUpCount += 1;
        await sessionStore.save(session);
      } else {
        // No follow-up: advance to next question or terminate
        await advanceSession(session, io);
      }

      // Notify client
      io.to(sessionId).emit('evaluationReady', {
        questionId,
        scores:    evaluation.scores,
        feedback:  evaluation.feedback,
        followUp:  evaluation.followUp,
      });

      return evaluation;
    },
    { connection: redisConnection, concurrency: 5 }
  );

  // ── 2. Generate Question ─────────────────────────────────────
  const questionWorker = new Worker<GenerateQuestionJob>(
    QUEUE_NAMES.GENERATE_QUESTION,
    async (job: Job<GenerateQuestionJob>) => {
      const { sessionId, role, level, previousQuestions: previousIds } = job.data;
      console.log(`[Worker:generateQuestion] Processing ${job.id} for session ${sessionId}`);

      const session = await sessionStore.get(sessionId);
      if (!session) throw new Error(`Session ${sessionId} not found`);

      const question = await generateQuestion({
        sessionId,
        role,
        level,
        previousQuestions: session.questions,
      });

      session.questions.push(question);
      session.state = 'AWAIT_ANSWER';
      await sessionStore.save(session);

      // Notify client: new question ready
      io.to(sessionId).emit('questionReady', {
        questionId: question.id,
        text:       question.text,
        type:       question.type,
        topic:      question.topic,
      });

      return question;
    },
    { connection: redisConnection, concurrency: 5 }
  );

  // ── 3. Generate Follow-up ────────────────────────────────────
  const followUpWorker = new Worker<GenerateFollowUpJob>(
    QUEUE_NAMES.GENERATE_FOLLOW_UP,
    async (job: Job<GenerateFollowUpJob>) => {
      const { sessionId, questionId, originalQuestion, candidateAnswer, missingKeywords } = job.data;
      console.log(`[Worker:generateFollowUp] Processing ${job.id} for session ${sessionId}`);

      const session = await sessionStore.get(sessionId);
      if (!session) throw new Error(`Session ${sessionId} not found`);

      const parentQuestion = session.questions.find(q => q.id === questionId);
      if (!parentQuestion) throw new Error(`Parent question ${questionId} not found`);

      const followUp = await generateFollowUp({
        sessionId,
        parentQuestion,
        candidateAnswer,
        missingKeywords,
      });

      session.questions.push(followUp);
      session.state = 'AWAIT_FU_ANSWER';
      session.totalFollowUps += 1;
      await sessionStore.save(session);

      // Notify client: follow-up question ready
      io.to(sessionId).emit('followUpReady', {
        questionId:       followUp.id,
        text:             followUp.text,
        parentQuestionId: questionId,
      });

      return followUp;
    },
    { connection: redisConnection, concurrency: 5 }
  );

  // ── 4. Compute Scorecard ─────────────────────────────────────
  const scorecardWorker = new Worker<ComputeScorecardJob>(
    QUEUE_NAMES.COMPUTE_SCORECARD,
    async (job: Job<ComputeScorecardJob>) => {
      const { sessionId } = job.data;
      console.log(`[Worker:computeScorecard] Processing ${job.id} for session ${sessionId}`);

      const session = await sessionStore.get(sessionId);
      if (!session) throw new Error(`Session ${sessionId} not found`);

      const scorecard = computeScorecard({
        context:        session.context,
        questions:      session.questions,
        evaluations:    session.evaluations,
        totalFollowUps: session.totalFollowUps,
      });

      session.state = 'COMPLETE';
      await sessionStore.save(session);

      // Notify client: scorecard complete
      io.to(sessionId).emit('scorecardReady', scorecard);
      io.to(sessionId).emit('interviewComplete', { sessionId });

      return scorecard;
    },
    { connection: redisConnection, concurrency: 3 }
  );

  // ─── Attach shared error handlers ─────────────────────────────
  [evaluateWorker, questionWorker, followUpWorker, scorecardWorker].forEach(worker => {
    worker.on('failed', (job, err) => {
      const sid = (job?.data as { sessionId?: string })?.sessionId;
      console.error(`[Worker] Job ${job?.id} failed:`, err.message);

      if (sid) {
        io.to(sid).emit('workerError', {
          jobId:   job?.id,
          message: err.message,
        });
      }
    });

    worker.on('completed', job => {
      console.log(`[Worker] Job ${job.id} completed in ${job.processedOn! - job.timestamp}ms`);
    });
  });

  workers.push(evaluateWorker, questionWorker, followUpWorker, scorecardWorker);
  return workers;
}

// ─── Session advancement logic ────────────────────────────────

async function advanceSession(
  session: Awaited<ReturnType<typeof sessionStore.get>>,
  io: SocketServer,
): Promise<void> {
  if (!session) return;

  const { config } = session;
  const primaryQuestions = session.questions.filter(q => !q.isFollowUp);
  const hasMoreQuestions  = primaryQuestions.length < config.maxQuestions;

  if (hasMoreQuestions) {
    session.state = 'GENERATE_Q';
    session.currentQuestionIndex += 1;
    await sessionStore.save(session);

    // Enqueue next question generation
    await (await import('../queues/index')).enqueueGenerateQuestion({
      sessionId:          session.context.sessionId,
      role:               session.context.role,
      level:              session.context.level,
      previousQuestions:  session.questions.map(q => q.topic),
    });
  } else {
    // All questions done — compute scorecard
    session.state = 'TERMINATE';
    await sessionStore.save(session);

    await enqueueComputeScorecard({
      sessionId: session.context.sessionId,
      userId:    session.context.userId,
    });
  }
}
