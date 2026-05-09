'use client';

import { useEffect, useState, type ReactNode, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';

// Reusable modal shell. Portals to <body> so it escapes any ancestor with
// `backdrop-filter` / `filter` / `transform` (those create a containing block
// for `position: fixed` and would otherwise anchor the modal under the parent).
//
// Closes on:
//   - Esc keydown
//   - click on the backdrop (outer wrapper, not the card)
//   - any close button the consumer wires inside `children` to call `onClose`
//
// Children are the card. The shell only owns positioning + dimming.
export default function Modal({
  onClose,
  closeOnBackdrop = true,
  children,
}: {
  onClose: () => void;
  closeOnBackdrop?: boolean;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!mounted) return null;

  const handleBackdrop = (e: MouseEvent<HTMLDivElement>) => {
    if (!closeOnBackdrop) return;
    if (e.target === e.currentTarget) onClose();
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={handleBackdrop}
      className="fixed inset-0 z-[1000] grid place-items-center bg-slate-900/50 backdrop-blur-sm p-4 md:p-8"
    >
      {children}
    </div>,
    document.body,
  );
}
