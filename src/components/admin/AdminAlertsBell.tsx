'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, X } from 'lucide-react';
import Modal from '@/components/shared/Modal';
import type { AdminAlert } from '@/lib/adminAlerts';
import { AlertsCountBadge } from './AlertsCountBadge';
import { AlertsList } from './AlertsList';

// Bell button + count badge + modal hosting AlertsList. Composes the
// reusable primitives — swap this out for an /admin "needs attention"
// inline panel by lifting <AlertsList alerts={alerts} /> directly into a page.

export function AdminAlertsBell({ alerts }: { alerts: AdminAlert[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const count = alerts.length;

  // Close on any navigation. Mostly fires when admin clicks the Open
  // chevron on an alert row — the booking detail loads underneath and
  // the modal would otherwise still be covering it. Initial mount fires
  // a no-op `setOpen(false)`.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Global shortcut: ⌘K / Ctrl+K toggles the bell. preventDefault is
  // needed because some browsers map Ctrl+K to focusing the address bar's
  // search engine. The matching shortcut for search is ⌘J.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={count > 0 ? `Notifications (${count}) — ⌘K` : 'Notifications — ⌘K'}
        title="Notifications  ⌘K"
        className="relative grid place-items-center w-9 h-9 rounded-full bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm text-slate-600 hover:text-slate-900 transition-all"
      >
        <Bell className="w-4 h-4" />
        <AlertsCountBadge count={count} />
      </button>

      {open && (
        <Modal onClose={() => setOpen(false)}>
          <div className="relative w-full max-w-2xl max-h-[80vh] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-2xl p-6">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute top-4 right-4 grid place-items-center w-8 h-8 rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center justify-between mb-5 pr-8">
              <h2 className="text-sm font-mono uppercase tracking-widest text-slate-400">
                Notifications
              </h2>
              {count > 0 && (
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-300">
                  {count} {count === 1 ? 'item' : 'items'}
                </span>
              )}
            </div>
            <AlertsList alerts={alerts} />
          </div>
        </Modal>
      )}
    </>
  );
}
