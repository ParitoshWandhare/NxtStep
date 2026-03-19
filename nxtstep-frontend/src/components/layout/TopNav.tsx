// ============================================================
// NxtStep — Top Navigation Header
// ============================================================

import { Menu, Sun, Moon, Bell } from 'lucide-react';
import { useAppDispatch } from '@/app/hooks';
import { toggleSidebar } from '@/features/ui/uiSlice';
import { useTheme, useResponsive } from '@/hooks';
import { cn } from '@/utils';

interface TopNavProps {
  title?: string;
}

export default function TopNav({ title }: TopNavProps) {
  const dispatch = useAppDispatch();
  const { isDark, toggle } = useTheme();
  const { isMobile } = useResponsive();

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6 h-14 bg-[var(--color-bg)]/80 backdrop-blur-md border-b border-[var(--color-border)]">
       {/* Menu toggle — mobile only  */}
      {isMobile && (
        <button
          onClick={() => dispatch(toggleSidebar())}
          className="p-2 rounded-xl hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] transition-colors"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
      )}

      {/* Page title */}
      {title && (
        <h1 className="font-display font-semibold text-base text-[var(--color-text-primary)] flex-1 truncate">
          {title}
        </h1>
      )}

      <div className="ml-auto flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={toggle}
          className={cn(
            'p-2 rounded-xl transition-all duration-200',
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