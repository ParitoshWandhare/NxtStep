// ============================================================
// NxtStep — Form Input Components
// ============================================================

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/utils';

// ── Input ─────────────────────────────────────────────────────
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, wrapperClassName, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className={cn('flex flex-col', wrapperClassName)}>
        {label && (
          <label htmlFor={inputId} className="label-field">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'input-field',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              error && 'border-red-500 focus:ring-red-500',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
              {rightIcon}
            </span>
          )}
        </div>
        {error && <p className="error-text">{error}</p>}
        {hint && !error && (
          <p className="text-xs text-[var(--color-text-muted)] mt-1">{hint}</p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

// ── Textarea ──────────────────────────────────────────────────
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
  showCount?: boolean;
  maxLength?: number;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, wrapperClassName, showCount, maxLength, className, id, value, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const charCount = typeof value === 'string' ? value.length : 0;
    return (
      <div className={cn('flex flex-col', wrapperClassName)}>
        {label && (
          <label htmlFor={inputId} className="label-field">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          value={value}
          maxLength={maxLength}
          className={cn(
            'input-field resize-none min-h-[120px]',
            error && 'border-red-500 focus:ring-red-500',
            className
          )}
          {...props}
        />
        <div className="flex items-center justify-between mt-1">
          {error && <p className="error-text">{error}</p>}
          {hint && !error && (
            <p className="text-xs text-[var(--color-text-muted)]">{hint}</p>
          )}
          {showCount && maxLength && (
            <p className={cn(
              'text-xs ml-auto',
              charCount > maxLength * 0.9
                ? 'text-red-500'
                : 'text-[var(--color-text-muted)]'
            )}>
              {charCount}/{maxLength}
            </p>
          )}
        </div>
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

// ── Select ────────────────────────────────────────────────────
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, wrapperClassName, options, placeholder, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className={cn('flex flex-col', wrapperClassName)}>
        {label && (
          <label htmlFor={inputId} className="label-field">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={cn(
            'input-field appearance-none cursor-pointer',
            error && 'border-red-500 focus:ring-red-500',
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="error-text">{error}</p>}
        {hint && !error && (
          <p className="text-xs text-[var(--color-text-muted)] mt-1">{hint}</p>
        )}
      </div>
    );
  }
);
Select.displayName = 'Select';