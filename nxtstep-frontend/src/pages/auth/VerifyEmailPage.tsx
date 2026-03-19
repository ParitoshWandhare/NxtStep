// ============================================================
// NxtStep — Verify Email Page
// ============================================================

import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useVerifyEmail, useResendOtp } from '@/hooks/useApi';
import { usePageTitle, useCountdown } from '@/hooks';

export default function VerifyEmailPage() {
  usePageTitle('Verify Email');
  const navigate = useNavigate();
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const verifyEmail = useVerifyEmail();
  const resendOtp = useResendOtp();
  const countdown = useCountdown(60);

  useEffect(() => {
    countdown.start();
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[index] = val;
    setDigits(next);
    if (val && index < 5) inputRefs.current[index + 1]?.focus();
    if (next.every(d => d !== '') && val) {
      submitOtp(next.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(''));
      submitOtp(pasted);
    }
  };

  const submitOtp = async (otp: string) => {
    try {
      await verifyEmail.mutateAsync(otp);
      navigate('/dashboard');
    } catch {
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  const handleResend = async () => {
    try {
      await resendOtp.mutateAsync();
      countdown.reset(60);
      countdown.start();
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch { /* toast */ }
  };

  return (
    <div className="card-surface p-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-primary-500/10 flex items-center justify-center mx-auto mb-6">
        <ShieldCheck className="text-primary-500" size={28} />
      </div>
      <h1 className="font-display font-bold text-2xl text-[var(--color-text-primary)] mb-2">
        Check your email
      </h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-8 leading-relaxed">
        We sent a 6-digit verification code to your email address. It expires in 10 minutes.
      </p>

      <div className="flex justify-center gap-2.5 mb-8" onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={el => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            className="w-12 h-14 text-center text-xl font-bold font-mono rounded-xl border-2 bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] border-[var(--color-border)] focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-150"
          />
        ))}
      </div>

      <Button
        fullWidth size="lg"
        loading={verifyEmail.isPending}
        onClick={() => submitOtp(digits.join(''))}
        disabled={digits.some(d => !d)}
      >
        Verify email
      </Button>

      <div className="mt-6 text-sm text-[var(--color-text-muted)]">
        Didn't receive the code?{' '}
        {countdown.seconds > 0 ? (
          <span>Resend in {countdown.seconds}s</span>
        ) : (
          <button
            onClick={handleResend}
            disabled={resendOtp.isPending}
            className="text-primary-500 hover:text-primary-600 font-medium transition-colors"
          >
            {resendOtp.isPending ? 'Sending…' : 'Resend code'}
          </button>
        )}
      </div>
    </div>
  );
}
