// ============================================================
// NxtStep Interview Engine — Session State Machine
// Manages valid transitions and enforces the session lifecycle.
// ============================================================

import { InterviewState } from '../types/interview.types';

// ─── Valid transitions map ────────────────────────────────────

const TRANSITIONS: Record<InterviewState, InterviewState[]> = {
  INIT:           ['PREP'],
  PREP:           ['GENERATE_Q'],
  GENERATE_Q:     ['AWAIT_ANSWER'],
  AWAIT_ANSWER:   ['PROCESS_ANSWER'],
  PROCESS_ANSWER: ['EVALUATE'],
  EVALUATE:       ['DECIDE_FOLLOWUP'],
  DECIDE_FOLLOWUP:['GENERATE_FU', 'LOOP', 'TERMINATE'],
  GENERATE_FU:    ['AWAIT_FU_ANSWER'],
  AWAIT_FU_ANSWER:['PROCESS_ANSWER'],
  LOOP:           ['GENERATE_Q', 'TERMINATE'],
  TERMINATE:      ['AGGREGATE'],
  AGGREGATE:      ['COMPLETE'],
  COMPLETE:       [],  // terminal state
};

// ─── StateMachine class ───────────────────────────────────────

export class InterviewStateMachine {
  private _state: InterviewState;
  private readonly sessionId: string;

  constructor(sessionId: string, initialState: InterviewState = 'INIT') {
    this.sessionId = sessionId;
    this._state    = initialState;
  }

  get state(): InterviewState {
    return this._state;
  }

  /**
   * Attempts to transition to the given state.
   * Throws if the transition is not allowed.
   */
  transition(next: InterviewState): void {
    const allowed = TRANSITIONS[this._state];

    if (!allowed.includes(next)) {
      throw new Error(
        `[StateMachine] Session ${this.sessionId}: ` +
        `Invalid transition ${this._state} → ${next}. ` +
        `Allowed: [${allowed.join(', ')}]`
      );
    }

    console.log(
      `[StateMachine] ${this.sessionId}: ${this._state} → ${next}`
    );
    this._state = next;
  }

  /**
   * Returns true if the transition is valid without throwing.
   */
  canTransition(next: InterviewState): boolean {
    return TRANSITIONS[this._state].includes(next);
  }

  /**
   * Returns the list of valid next states from the current state.
   */
  allowedTransitions(): InterviewState[] {
    return TRANSITIONS[this._state];
  }

  isTerminal(): boolean {
    return this._state === 'COMPLETE';
  }

  isActive(): boolean {
    return !this.isTerminal();
  }

  isAwaiting(): boolean {
    return this._state === 'AWAIT_ANSWER' || this._state === 'AWAIT_FU_ANSWER';
  }
}

// ─── State machine factory ────────────────────────────────────

export function createStateMachine(
  sessionId: string,
  currentState?: InterviewState,
): InterviewStateMachine {
  return new InterviewStateMachine(sessionId, currentState);
}
