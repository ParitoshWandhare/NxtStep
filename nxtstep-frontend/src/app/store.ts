// ============================================================
// NxtStep — Redux Store
// ============================================================

import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/authSlice';
import interviewReducer from '@/features/interview/interviewSlice';
import uiReducer from '@/features/ui/uiSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    interview: interviewReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['interview/setCurrentQuestion'],
      },
    }),
  devTools: import.meta.env.DEV,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;