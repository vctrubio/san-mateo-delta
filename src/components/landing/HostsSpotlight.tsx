'use client';

import { motion } from 'framer-motion';
import fincaData from '@config/finca.json';

// ============================================================================
// HostsSpotlight — the "Souls of San Mateo" host portraits.
//
// Same component on the landing /  page (`AboutSection`) and inside the
// property page (`PropertyView`, below "What's included") so the brand
// voice for the people behind the finca stays consistent.
// ============================================================================

export type Host = {
  name: string;
  role: string;
  quote: string;
  image: string;
  haloClass: string;
};

export function HostsSpotlight({
  hosts = fincaData.hosts,
}: {
  hosts?: readonly Host[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.2 }}
      viewport={{ once: true }}
      className="space-y-12"
    >
      <div className="flex items-center gap-4">
        <div className="h-px grow bg-slate-100" />
        <span className="text-[10px] font-mono text-slate-300 uppercase tracking-[0.4em]">
          The Souls of {fincaData.name}
        </span>
        <div className="h-px grow bg-slate-100" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
        {hosts.map((host) => (
          <HostCard key={host.name} host={host} />
        ))}
      </div>
    </motion.div>
  );
}

export function HostCard({ host }: { host: Host }) {
  return (
    <div className="flex flex-col items-center text-center group">
      <div className="relative mb-6">
        <div className={`absolute inset-0 ${host.haloClass} rounded-full scale-110 group-hover:scale-125 transition-transform duration-700 opacity-50`} />
        <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-xl">
          {/* Plain <img> here (not next/image) to match the landing — the
              avatar art is small and the layout doesn't need lazy/sizing. */}
          <img src={host.image} alt={host.name} className="object-cover w-full h-full" />
        </div>
      </div>
      <div className="space-y-3">
        <div>
          <h4 className="text-2xl font-bold text-slate-900 tracking-tight">{host.name}</h4>
          <span className="text-xs font-mono text-ocean uppercase tracking-widest">{host.role}</span>
        </div>
        <p className="text-slate-500 text-sm italic leading-relaxed max-w-[240px]">
          &ldquo;{host.quote}&rdquo;
        </p>
      </div>
    </div>
  );
}
