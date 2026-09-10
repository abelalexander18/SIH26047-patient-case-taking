import React from 'react';
import { Loader2 } from 'lucide-react';

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  icon: Icon,
  iconPosition = 'left',
  className = '',
  onClick,
  type = 'button',
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none cursor-pointer';

  const variants = {
    primary: 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm hover:shadow border border-transparent focus:ring-slate-900',
    medical: 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md border border-transparent focus:ring-blue-600',
    secondary: 'bg-blue-50/80 hover:bg-blue-100 text-blue-700 border border-blue-200/60 focus:ring-blue-400',
    teal: 'bg-teal-600 hover:bg-teal-700 text-white shadow-sm hover:shadow focus:ring-teal-500',
    tealSubtle: 'bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200/80 focus:ring-teal-400',
    outline: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs hover:border-slate-300 focus:ring-slate-400',
    ghost: 'bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900 focus:ring-slate-300',
    danger: 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 focus:ring-rose-400',
    dangerSolid: 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm focus:ring-rose-500',
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2.5 gap-2',
    lg: 'text-base px-6 py-3.5 gap-2.5 shadow-sm',
    icon: 'p-2.5 text-slate-600',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-current" />
          <span>Processing...</span>
        </>
      ) : (
        <>
          {Icon && iconPosition === 'left' && <Icon className="w-4 h-4 shrink-0" />}
          {children}
          {Icon && iconPosition === 'right' && <Icon className="w-4 h-4 shrink-0" />}
        </>
      )}
    </button>
  );
};

export default Button;
