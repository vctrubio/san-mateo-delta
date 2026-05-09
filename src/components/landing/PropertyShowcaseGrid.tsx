'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { Users, X, Check, BedDouble, Bath, Maximize, MoveRight } from 'lucide-react';
import type { Property } from '@/lib/properties';
import Modal from '@/components/shared/Modal';

const RATIO_BY_INDEX = [
  'col-span-2 md:col-span-4',
  'col-span-1 md:col-span-2',
  'col-span-1 md:col-span-2',
  'col-span-1 md:col-span-2',
];

function imageFor(slug: string) {
  return `/images/${slug}.png`;
}

function displayName(slug: string) {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

export default function PropertyShowcaseGrid({ properties }: { properties: Property[] }) {
  const [selected, setSelected] = useState<Property | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-10 gap-4">
        {properties.map((p, index) => (
          <motion.button
            key={p.id}
            type="button"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
            viewport={{ once: true }}
            onClick={() => setSelected(p)}
            className={`relative aspect-[4/5] md:aspect-auto md:h-[600px] rounded-3xl overflow-hidden group cursor-pointer text-left ${RATIO_BY_INDEX[index] ?? 'col-span-1 md:col-span-2'}`}
          >
            <Image
              src={imageFor(p.slug)}
              alt={displayName(p.slug)}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 opacity-80" />
            <div className="absolute top-8 left-8 right-8 flex flex-col gap-1">
              <h3 className="text-3xl md:text-5xl font-bold text-white uppercase tracking-tighter">
                {displayName(p.slug)}
              </h3>
              <span className="text-xs md:text-sm font-mono text-white/70 uppercase tracking-[0.3em]">
                {p.title}
              </span>
            </div>
            <div className="absolute bottom-8 left-8 flex items-center gap-2">
              <div className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20 flex items-center gap-2">
                <Users className="w-4 h-4 text-white" />
                <span className="text-xs font-mono text-white uppercase tracking-widest">
                  Sleeps {p.max_guests}
                </span>
              </div>
            </div>
            <div className="absolute inset-0 border-[1px] border-white/0 group-hover:border-white/20 transition-all duration-500 rounded-3xl m-4 pointer-events-none" />
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {selected && <PropertyModal property={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </>
  );
}

function PropertyModal({ property, onClose }: { property: Property; onClose: () => void }) {
  return (
    <Modal onClose={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-6xl bg-white rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col md:flex-row min-h-[70vh] max-h-[90vh]"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 z-50 p-2 bg-white/20 backdrop-blur-md hover:bg-white/40 rounded-full text-slate-800 transition-all border border-slate-100"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative w-full md:w-1/2 h-64 md:h-auto shrink-0">
          <Image
            src={imageFor(property.slug)}
            alt={displayName(property.slug)}
            fill
            className="object-cover"
          />
        </div>

        <div className="flex-1 p-8 md:p-12 flex flex-col justify-between overflow-y-auto">
          <div>
            <span className="text-xs font-mono text-ocean uppercase tracking-[0.4em] block mb-2">
              {property.title}
            </span>
            <h3 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tighter uppercase mb-4 leading-none">
              {displayName(property.slug)}
            </h3>
            <p className="text-slate-500 text-sm md:text-base leading-relaxed mb-6">
              {property.description}
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <Stat icon={BedDouble} label="Bedrooms" value={property.bedrooms} />
              <Stat icon={Bath}      label="Bathrooms" value={property.bathrooms} />
              <Stat icon={Maximize}  label="Size"      value={`${property.m2} m²`} />
              <Stat icon={Users}     label="Sleeps"    value={property.max_guests} />
            </div>

            {property.features.length > 0 && (
              <div className="mb-6">
                <h4 className="text-[9px] font-mono text-slate-300 uppercase tracking-widest mb-3">
                  Property Features
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {property.features.map((f) => (
                    <div key={f} className="flex items-center gap-2.5">
                      <div className="w-4 h-4 bg-sky rounded-full flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-ocean" />
                      </div>
                      <span className="text-xs text-slate-600 font-medium">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Link
            href={`/finca/${property.slug}`}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-slate-900 text-white hover:bg-ocean hover:shadow-xl hover:shadow-ocean/20 transition-all duration-300 font-bold uppercase tracking-[0.2em] text-xs"
          >
            <span>View full property</span>
            <MoveRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </motion.div>
    </Modal>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BedDouble;
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100/60">
      <h4 className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">{label}</h4>
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-ocean shrink-0" />
        <span className="font-bold text-slate-900 text-sm">{value}</span>
      </div>
    </div>
  );
}
