// ============================================================
// NxtStep — Reset Password Page
// ============================================================

import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/FormFields';
import Button from '@/components/ui/Button';
import { useResetPassword } from '@/hooks/useApi';
import { usePageTitle } from '@/hooks';

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Z]/, 'Need one uppercase letter')
      .regex(/[0-9]/, 'Need one number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  usePageTitle('Reset Password');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [showPw, setShowPw] = useState(false);
  const reset = useResetPassword();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      await reset.mutateAsync({ token, password: data.password });
      navigate('/login');
    } catch { /* toast handles */ }
  };

  if (!token) {
    return (
      <div className="card-surface p-8 text-center">
        <p className="text-[var(--color-text-muted)] mb-4">Invalid or missing reset token.</p>
        <Link to="/forgot-password" className="btn-primary inline-flex">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="card-surface p-8">
      <div className="mb-8">
        <h1 className="font-display font-bold text-2xl text-[var(--color-text-primary)] mb-1.5">
          Create new password
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Choose a strong password for your account.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="New password"
          type={showPw ? 'text' : 'password'}
          placeholder="Min 8 chars, 1 uppercase, 1 number"
          leftIcon={<Lock size={16} />}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPw((p) => !p)}
              tabIndex={-1}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
          error={errors.password?.message}
          {...register('password')}
        />
        <Input
          label="Confirm new password"
          type={showPw ? 'text' : 'password'}
          placeholder="Re-enter password"
          leftIcon={<Lock size={16} />}
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <Button type="submit" fullWidth size="lg" loading={reset.isPending}>
          Reset password
        </Button>
      </form>
    </div>
  );
}
