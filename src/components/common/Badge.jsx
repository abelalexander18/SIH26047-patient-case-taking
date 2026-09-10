import React from 'react';

const Badge = ({
  children,
  variant = 'slate',
  size = 'md',
  dot = false,
  className = '',
  icon: Icon
}) => {
  const variants = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200/70',
    teal: 'bg-teal-50 text-teal-800 border-teal-200/80',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
  };

  const dotColors = {
    slate: 'bg-slate-400',
    blue: 'bg-blue-500',
    teal: 'bg-teal-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
  };

  const sizes = {
    sm: 'text-[11px] px-2 py-0.5 font-medium',
    md: 'text-xs px-2.5 py-1 font-medium',
    lg: 'text-sm px-3 py-1.5 font-medium',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border shadow-2xs ${variants[variant] || variants.slate} ${sizes[size] || sizes.md} ${className}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[variant] || dotColors.slate}`}
        />
      )}
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
      {children}
    </span>
  );
};

export default Badge;
