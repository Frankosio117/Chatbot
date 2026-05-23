import React, { useId } from 'react';
import { ChevronDown } from 'lucide-react';

// ─── CARD ──────────────────────────────────────────────────────────────────────
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <div
      className={`bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden transition-colors duration-200 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', ...props }: CardProps) {
  return (
    <div className={`px-6 py-4 border-b border-zinc-800 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardContent({ children, className = '', ...props }: CardProps) {
  return (
    <div className={`px-6 py-5 ${className}`} {...props}>
      {children}
    </div>
  );
}

// ─── BUTTON ────────────────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none';

  const variants = {
    primary:
      'bg-yellow-400 hover:bg-yellow-300 text-zinc-950 focus-visible:ring-yellow-400 shadow-md shadow-yellow-400/10',
    secondary:
      'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 focus-visible:ring-zinc-500',
    danger:
      'bg-rose-500 hover:bg-rose-400 text-white focus-visible:ring-rose-500',
    success:
      'bg-emerald-500 hover:bg-emerald-400 text-white focus-visible:ring-emerald-500',
    ghost:
      'bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 focus-visible:ring-zinc-500',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2.5 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <svg className="animate-spin h-4 w-4 text-current shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Guardando...
        </>
      ) : (
        children
      )}
    </button>
  );
}

// ─── INPUT ─────────────────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    const reactId = useId();
    const inputId = id || reactId;
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={`w-full px-3.5 py-2.5 bg-zinc-950 border ${
            error
              ? 'border-rose-500 focus:border-rose-400 focus:ring-rose-500/20'
              : 'border-zinc-800 hover:border-zinc-700 focus:border-yellow-400 focus:ring-yellow-400/10'
          } rounded-xl text-sm text-zinc-100 placeholder-zinc-600 transition-all duration-150 focus:outline-none focus:ring-2 ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-rose-400">{error}</p>}
        {!error && helperText && <p className="text-xs text-zinc-500">{helperText}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

// ─── TEXTAREA ──────────────────────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    const reactId = useId();
    const textareaId = id || reactId;
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={textareaId} className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          className={`w-full px-3.5 py-2.5 bg-zinc-950 border ${
            error
              ? 'border-rose-500 focus:border-rose-400 focus:ring-rose-500/20'
              : 'border-zinc-800 hover:border-zinc-700 focus:border-yellow-400 focus:ring-yellow-400/10'
          } rounded-xl text-sm text-zinc-100 placeholder-zinc-600 transition-all duration-150 focus:outline-none focus:ring-2 min-h-[100px] resize-y ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-rose-400">{error}</p>}
        {!error && helperText && <p className="text-xs text-zinc-500 leading-relaxed">{helperText}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

// ─── SELECT ────────────────────────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: { value: string; label: string }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, options, className = '', id, ...props }, ref) => {
    const reactId = useId();
    const selectId = id || reactId;
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            className={`w-full appearance-none px-3.5 py-2.5 bg-zinc-950 border ${
              error
                ? 'border-rose-500 focus:border-rose-400'
                : 'border-zinc-800 hover:border-zinc-700 focus:border-yellow-400'
            } rounded-xl text-sm text-zinc-100 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-yellow-400/10 pr-10 cursor-pointer ${className}`}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} style={{ background: '#141414', color: '#f4f4f5' }}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        </div>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        {!error && helperText && <p className="text-xs text-zinc-500">{helperText}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';

// ─── BADGE ─────────────────────────────────────────────────────────────────────
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'yellow' | 'emerald' | 'rose' | 'zinc' | 'indigo';
}

export function Badge({ children, variant = 'zinc' }: BadgeProps) {
  const styles = {
    yellow: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    zinc: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${styles[variant]}`}>
      {children}
    </span>
  );
}
