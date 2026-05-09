'use client';

// Default action-slot content for the admin shell. Renders the two persistent
// circles (notifications + account) on every admin route. Routes that want
// extra route-specific actions can add a sibling `@actions/<segment>/page.tsx`
// to override.

import { Bell, User } from 'lucide-react';

export default function DefaultAdminActions() {
  return (
    <>
      <CircleButton ariaLabel="Notifications" onClick={() => console.log('notifications')}>
        <Bell className="w-4 h-4" />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-slate-50" />
      </CircleButton>
      <CircleButton ariaLabel="Account" onClick={() => console.log('account')}>
        <User className="w-4 h-4" />
      </CircleButton>
    </>
  );
}

function CircleButton({
  children,
  ariaLabel,
  onClick,
}: {
  children: React.ReactNode;
  ariaLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="relative grid place-items-center w-9 h-9 rounded-full bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm text-slate-600 hover:text-slate-900 transition-all"
    >
      {children}
    </button>
  );
}
