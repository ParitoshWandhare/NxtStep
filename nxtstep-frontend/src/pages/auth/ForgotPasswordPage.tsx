// ============================================================
// NxtStep — Forgot Password Page
// ============================================================

import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/FormFields';
import Button from '@/components/ui/Button';
import { useForgotPassword } from '@/hooks/useApi';
import { usePageTitle } from '@/hooks';

const schema = z.object({ email: z.string().email('Enter a valid email') });
type FormData = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  usePageTitle('Forgot Password');
  const fp = useForgotPassword();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    await fp.mutateAsync(data.email);
  };

  if (fp.isSuccess) {
    return (
      <div className="card-surface p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
          <Mail className="text-emerald-500" size={28} />
        </div>
        <h2 className="font-display font-bold text-2xl text-[var(--color-text-primary)] mb-3">Check your inbox</h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-6 leading-relaxed">
          If that email is registered, you'll receive a reset link shortly. Check your spam folder too.
        </p>
        <Link to="/login" className="btn-primary inline-flex">Back to sign in</Link>
      </div>
    );
  }

  return (
    <div className="card-surface p-8">
      <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-6 transition-colors">
        <ArrowLeft size={16} /> Back to sign in
      </Link>
      <div className="mb-8">
        <h1 className="font-display font-bold text-2xl text-[var(--color-text-primary)] mb-1.5">Reset password</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Enter your email and we'll send a reset link.</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Email" type="email" placeholder="you@example.com"
          leftIcon={<Mail size={16} />} error={errors.email?.message} {...register('email')} />
        <Button type="submit" fullWidth size="lg" loading={fp.isPending}>Send reset link</Button>
      </form>
    </div>
  );
}

export default ForgotPasswordPage;

// ============================================================
// NxtStep — Reset Password Page
// ============================================================

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z as zz } from 'zod';
import { useForm as useFormReset } from 'react-hook-form';
import { zodResolver as zrResolver } from '@hookform/resolvers/zod';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { useResetPassword } from '@/hooks/useApi';

const resetSchema = zz.object({
  password: zz.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
  confirmPassword: zz.string(),
}).refine(d => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });
type ResetFormData = zz.infer<typeof resetSchema>;

export function ResetPasswordPage() {
  usePageTitle('Reset Password');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [showPw, setShowPw] = useState(false);
  const reset = useResetPassword();

  const { register, handleSubmit, formState: { errors } } = useFormReset<ResetFormData>({
    resolver: zrResolver(resetSchema),
  });

  const onSubmit = async (data: ResetFormData) => {
    try {
      await reset.mutateAsync({ token, password: data.password });
      navigate('/login');
    } catch { /* toast */ }
  };

  if (!token) {
    return (
      <div className="card-surface p-8 text-center">
        <p className="text-[var(--color-text-muted)]">Invalid or missing reset token.</p>
        <Link to="/forgot-password" className="btn-primary mt-4 inline-flex">Request new link</Link>
      </div>
    );
  }

  return (
    <div className="card-surface p-8">
      <div className="mb-8">
        <h1 className="font-display font-bold text-2xl text-[var(--color-text-primary)] mb-1.5">Create new password</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Choose a strong password to protect your account.</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="New password" type={showPw ? 'text' : 'password'}
          placeholder="Min 8 chars, 1 uppercase, 1 number"
          leftIcon={<Lock size={16} />}
          rightIcon={
            <button type="button" onClick={() => setShowPw(p => !p)} tabIndex={-1}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
          error={errors.password?.message} {...register('password')} />
        <Input label="Confirm new password" type={showPw ? 'text' : 'password'}
          placeholder="Re-enter password" leftIcon={<Lock size={16} />}
          error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <Button type="submit" fullWidth size="lg" loading={reset.isPending}>Reset password</Button>
      </form>
    </div>
  );
}
