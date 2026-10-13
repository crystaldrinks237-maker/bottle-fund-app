'use client';
import React from 'react';

/** The official Crystal Drinks logo. It is full-colour, so it is shown on a white surface (white header, white footer badge). */
export function Logo({ className = 'h-[52px]' }: { className?: string }) {
  return <img src="/logo.png" alt="Crystal Drinks" width={540} height={601} className={`${className} w-auto`} />;
}
