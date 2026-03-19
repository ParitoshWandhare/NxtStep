// ============================================================
// NxtStep — PageLoader
// ============================================================

export default function PageLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[var(--color-bg)] z-50">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-2xl bg-primary-500 flex items-center justify-center shadow-glow">
            <span className="text-white font-display font-bold text-xl">N</span>
          </div>
          <div className="absolute -inset-1.5 rounded-2xl border-2 border-primary-500/30 animate-ping" />
        </div>
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary-400 animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 rounded-full bg-primary-500 animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-primary-600 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}