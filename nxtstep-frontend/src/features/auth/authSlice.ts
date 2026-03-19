// ============================================================
// NxtStep — Auth Slice
// ============================================================

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { User, AuthState } from '@/types';

const TOKEN_KEY = 'nxtstep-token';
const USER_KEY = 'nxtstep-user';

const loadStoredAuth = (): { token: string | null; user: User | null } => {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const userStr = localStorage.getItem(USER_KEY);
    const user = userStr ? (JSON.parse(userStr) as User) : null;
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
};

const stored = loadStoredAuth();

const initialState: AuthState = {
  user: stored.user,
  token: stored.token,
  isAuthenticated: !!(stored.token && stored.user),
  isLoading: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ token: string; user: User }>) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.isLoading = false;
      localStorage.setItem(TOKEN_KEY, action.payload.token);
      localStorage.setItem(USER_KEY, JSON.stringify(action.payload.user));
    },

    updateUser(state, action: PayloadAction<Partial<User>>) {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        localStorage.setItem(USER_KEY, JSON.stringify(state.user));
      }
    },

    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },

    logout(state) {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },
  },
});

export const { setCredentials, updateUser, setLoading, logout } = authSlice.actions;
export default authSlice.reducer;

// Selectors
export const selectCurrentUser = (state: { auth: AuthState }) => state.auth.user;
export const selectToken = (state: { auth: AuthState }) => state.auth.token;
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated;
export const selectAuthLoading = (state: { auth: AuthState }) => state.auth.isLoading;