// ============================================================
// NxtStep — Interview Slice
// ============================================================

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Question, EvaluationResult, InterviewReduxState } from '@/types';

const initialState: InterviewReduxState = {
  sessionId: null,
  sessionToken: null,
  currentQuestion: null,
  pendingAnswer: '',
  isAnswering: false,
  isWaitingForQuestion: false,
  evaluationResults: {},
  proctoringWarnings: 0,
  isSessionActive: false,
  engineState: 'IDLE',
};

const interviewSlice = createSlice({
  name: 'interview',
  initialState,
  reducers: {
    startSession(
      state,
      action: PayloadAction<{ sessionId: string; sessionToken: string }>
    ) {
      state.sessionId = action.payload.sessionId;
      state.sessionToken = action.payload.sessionToken;
      state.isSessionActive = true;
      state.isWaitingForQuestion = true;
      state.engineState = 'GENERATE_Q';
      state.proctoringWarnings = 0;
      state.evaluationResults = {};
      state.currentQuestion = null;
      state.pendingAnswer = '';
    },

    setCurrentQuestion(state, action: PayloadAction<Question>) {
      state.currentQuestion = action.payload;
      state.isWaitingForQuestion = false;
      state.isAnswering = false;
      state.pendingAnswer = '';
      state.engineState = 'AWAIT_ANSWER';
    },

    setIsAnswering(state, action: PayloadAction<boolean>) {
      state.isAnswering = action.payload;
    },

    setPendingAnswer(state, action: PayloadAction<string>) {
      state.pendingAnswer = action.payload;
    },

    setWaitingForQuestion(state, action: PayloadAction<boolean>) {
      state.isWaitingForQuestion = action.payload;
    },

    addEvaluationResult(state, action: PayloadAction<EvaluationResult>) {
      state.evaluationResults[action.payload.questionId] = action.payload;
    },

    incrementProctoringWarning(state) {
      state.proctoringWarnings += 1;
    },

    setEngineState(state, action: PayloadAction<string>) {
      state.engineState = action.payload;
    },

    endSession(state) {
      state.isSessionActive = false;
      state.isWaitingForQuestion = false;
      state.isAnswering = false;
      state.engineState = 'COMPLETE';
    },

    resetInterview() {
      return initialState;
    },
  },
});

export const {
  startSession,
  setCurrentQuestion,
  setIsAnswering,
  setPendingAnswer,
  setWaitingForQuestion,
  addEvaluationResult,
  incrementProctoringWarning,
  setEngineState,
  endSession,
  resetInterview,
} = interviewSlice.actions;

export default interviewSlice.reducer;

// Selectors
export const selectSessionId = (s: { interview: InterviewReduxState }) => s.interview.sessionId;
export const selectCurrentQuestion = (s: { interview: InterviewReduxState }) => s.interview.currentQuestion;
export const selectIsWaiting = (s: { interview: InterviewReduxState }) => s.interview.isWaitingForQuestion;
export const selectIsAnswering = (s: { interview: InterviewReduxState }) => s.interview.isAnswering;
export const selectPendingAnswer = (s: { interview: InterviewReduxState }) => s.interview.pendingAnswer;
export const selectEvaluations = (s: { interview: InterviewReduxState }) => s.interview.evaluationResults;
export const selectProctoringWarnings = (s: { interview: InterviewReduxState }) => s.interview.proctoringWarnings;
export const selectIsSessionActive = (s: { interview: InterviewReduxState }) => s.interview.isSessionActive;
export const selectEngineState = (s: { interview: InterviewReduxState }) => s.interview.engineState;