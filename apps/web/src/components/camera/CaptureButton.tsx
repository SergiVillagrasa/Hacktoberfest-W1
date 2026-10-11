'use client';

import { useRef, type ReactNode } from 'react';
import { resizeToJpeg } from './resize';

interface CaptureButtonProps {
  children: ReactNode;
  onPhoto: (photo: Blob) => void;
  onError?: (message: string) => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  className?: string;
}

/** A big button that opens the rear camera and hands back a resized photo (JPEG when the browser allows it). */
export function CaptureButton({ children, onPhoto, onError, variant = 'primary', disabled, className = '' }: CaptureButtonProps) {
  const input = useRef<HTMLInputElement>(null);

  async function picked(file: File | undefined) {
    if (input.current) input.current.value = '';
    if (!file) return;
    try {
      onPhoto(await resizeToJpeg(file));
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "We couldn't read that photo.");
    }
  }

  return (
    <label className={`chunky capture ${variant === 'secondary' ? 'chunky-secondary' : ''} ${className}`} aria-disabled={disabled || undefined}>
      {children}
      <input ref={input} type="file" accept="image/*" capture="environment" disabled={disabled} onChange={(e) => void picked(e.target.files?.[0])} className="capture-input" />
    </label>
  );
}
