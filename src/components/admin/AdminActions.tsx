'use client';

import { useState } from 'react';
import { Bell, Plus, X } from 'lucide-react';
import Modal from '@/components/shared/Modal';

type ModalKey = 'add' | 'notifications' | null;

export default function AdminActions() {
  const [open, setOpen] = useState<ModalKey>(null);
  const close = () => setOpen(null);

  return (
    <>
      <CircleButton ariaLabel="Add" onClick={() => setOpen('add')}>
        <Plus className="w-4 h-4" />
      </CircleButton>
      <CircleButton ariaLabel="Notifications" onClick={() => setOpen('notifications')}>
        <Bell className="w-4 h-4" />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-slate-50" />
      </CircleButton>

      {open === 'add' && (
        <Modal onClose={close}>
          <Card title="Add" onClose={close}>
            <p className="text-sm text-slate-500">Add modal — wire up later.</p>
          </Card>
        </Modal>
      )}
      {open === 'notifications' && (
        <Modal onClose={close}>
          <Card title="Notifications" onClose={close}>
            <p className="text-sm text-slate-500">No notifications yet.</p>
          </Card>
        </Modal>
      )}
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

function Card({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl p-8">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 grid place-items-center w-8 h-8 rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
      <h2 className="text-sm font-mono uppercase tracking-widest text-slate-400 mb-6">
        {title}
      </h2>
      {children}
    </div>
  );
}
