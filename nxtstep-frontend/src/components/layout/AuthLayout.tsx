// ============================================================
// NxtStep — Auth Layout
// ============================================================

import { Outlet, Link } from 'react-router-dom';
import { useTheme } from '@/hooks';
import { Sun, Moon } from 'lucide-react';

export default function AuthLayout() {
  const { isDark, toggle } = useTheme();

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)] bg-mesh">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-primary-500 flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-all duration-300">
            <span className="text-white font-display font-bold text-sm">N</span>
          </div>
          <span className="font-display font-bold text-base text-[var(--color-text-primary)]">
            NxtStep
          </span>
        </Link>

        <button
          onClick={toggle}
          className="p-2 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-all duration-200"
          aria-label="Toggle theme"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      {/* ── Content ─────────────────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md animate-slide-up">
          <Outlet />
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="py-4 text-center">
        <p className="text-xs text-[var(--color-text-muted)]">
          © {new Date().getFullYear()} NxtStep — AI Interview Platform
        </p>
      </footer>
    </div>
  );
}