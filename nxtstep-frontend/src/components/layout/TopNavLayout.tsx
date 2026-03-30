// ============================================================
// NxtStep — Top Navigation Header
// Always shows Home, About, Contact + app nav links
// ============================================================

import { Menu, Sun, Moon } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAppDispatch } from '@/app/hooks';
import { toggleSidebar } from '@/features/ui/uiSlice';
import { useTheme, useResponsive } from '@/hooks';
import { cn } from '@/utils';

interface TopNavProps {
  title?: string;
}

const PUBLIC_NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

export default function TopNav({ title }: TopNavProps) {
  const dispatch = useAppDispatch();
  const { isDark, toggle } = useTheme();
  const { isMobile } = useResponsive();

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6 h-14 bg-[var(--color-bg)]/80 backdrop-blur-md border-b border-[var(--color-border)]">
      {/* Menu toggle — mobile only */}
      {isMobile && (
        <button
          onClick={() => dispatch(toggleSidebar())}
          className="p-2 rounded-xl hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] transition-colors"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
      )}

      {/* Public nav links - always visible */}
      {!isMobile && (
        <nav className="flex items-center gap-0.5">
          {PUBLIC_NAV_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200',
                  isActive
                    ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-secondary)]'
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      )}

      {/* Page title */}
      {title && (
        <h1 className="font-display font-bold text-base text-[var(--color-text-primary)] flex-1 truncate">
          {title}
        </h1>
      )}

      <div className="ml-auto flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={toggle}
          className={cn(
            'p-2 rounded-xl transition-all duration-200 hover:scale-110',
            'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
            'hover:bg-[var(--color-bg-elevated)]'
          )}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
}