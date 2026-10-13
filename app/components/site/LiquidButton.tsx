'use client';
import React, { ReactNode } from 'react';

type Variant = 'solid' | 'outline' | 'dark' | 'outlineDark';

type LiquidButtonProps = {
  children: ReactNode;
  href?: string;
  external?: boolean;
  variant?: Variant;
  icon?: ReactNode;
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
};

const variants: Record<Variant, string> = {
  solid: 'bg-white text-midnight hover:bg-ice [--sweep:rgba(255,255,255,0.7)]',
  outline: 'border border-silver/40 text-white hover:border-white',
  dark: 'bg-midnight text-white hover:bg-ocean',
  outlineDark: 'border border-midnight/25 text-midnight hover:border-midnight [--sweep:rgba(201,232,245,0.6)]'
};

export function LiquidButton({
  children,
  href,
  external,
  variant = 'solid',
  icon,
  type = 'button',
  disabled,
  className = '',
  onClick
}: LiquidButtonProps) {
  const classes = `liquid-btn inline-flex items-center justify-center gap-3 whitespace-nowrap px-7 py-4 text-[12px] font-medium uppercase tracking-[0.2em] transition-colors duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ice disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`;

  const content =
  <>
      {icon}
      <span>{children}</span>
    </>;


  if (href) {
    return (
      <a
        href={href}
        className={classes}
        onClick={onClick}
        {...external ? { target: '_blank', rel: 'noopener noreferrer' } : {}}>
        
        {content}
      </a>);

  }

  return (
    <button type={type} className={classes} disabled={disabled} onClick={onClick}>
      {content}
    </button>);

}