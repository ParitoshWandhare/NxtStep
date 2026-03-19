// ============================================================
// NxtStep — 404 Not Found Page
// ============================================================

import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] bg-mesh px-4">
      <div className="text-center max-w-md animate-slide-up">
        <div className="relative mb-8 inline-block">
          <span className="font-display font-bold text-[10rem] leading-none text-[var(--color-bg-elevated)] select-none">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-2xl bg-primary-500 flex items-center justify-center shadow-glow">
              <span className="text-white font-display font-bold text-3xl">N</span>
            </div>
          </div>
        </div>

        <h1 className="font-display font-bold text-2xl text-[var(--color-text-primary)] mb-3">
          Page not found
        </h1>
        <p className="text-[var(--color-text-muted)] mb-8 leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/dashboard">
            <Button leftIcon={<Home size={16} />}>Go to Dashboard</Button>
          </Link>
          <button
            onClick={() => window.history.back()}
            className="btn-secondary"
          >
            <ArrowLeft size={16} />
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}
