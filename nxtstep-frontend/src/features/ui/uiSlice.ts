// ============================================================
// NxtStep — UI Slice
// Theme, sidebar, responsive state
// ============================================================

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Theme, UIReduxState } from '@/types';

const THEME_KEY = 'nxtstep-theme';

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY) as Theme | null;
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  localStorage.setItem(THEME_KEY, theme);
}

// Apply theme immediately to avoid flash-of-unstyled-content
const initialTheme = getInitialTheme();
applyTheme(initialTheme);

const initialState: UIReduxState = {
  theme: initialTheme,
  sidebarOpen: false,
  isMobile: window.innerWidth < 768,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<Theme>) {
      state.theme = action.payload;
      applyTheme(action.payload);
    },

    toggleTheme(state) {
      const next: Theme = state.theme === 'dark' ? 'light' : 'dark';
      state.theme = next;
      applyTheme(next);
    },

    setSidebarOpen(state, action: PayloadAction<boolean>) {
      state.sidebarOpen = action.payload;
    },

    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },

    setIsMobile(state, action: PayloadAction<boolean>) {
      state.isMobile = action.payload;
    },
  },
});

export const { setTheme, toggleTheme, setSidebarOpen, toggleSidebar, setIsMobile } =
  uiSlice.actions;

export default uiSlice.reducer;

// ── Selectors ─────────────────────────────────────────────────
export const selectTheme = (s: { ui: UIReduxState }) => s.ui.theme;
export const selectSidebarOpen = (s: { ui: UIReduxState }) => s.ui.sidebarOpen;
export const selectIsMobile = (s: { ui: UIReduxState }) => s.ui.isMobile;