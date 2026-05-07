'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { Users } from 'lucide-react';

const properties = [
  {
    id: 'levante',
    name: 'Levante',
    subtitle: 'The Villa',
    capacity: 6,
    image: '/images/levante.png',
    ratio: 'col-span-2 md:col-span-4',
    description: 'Our flagship villa. A masterpiece of coastal architecture featuring expansive living spaces and direct access to the estate gardens.',
    features: ['Private Terrace', 'Fully Equipped Kitchen', 'Starlink WiFi', 'Master Suite']
  },
  {
    id: 'estrecho',
    name: 'Estrecho',
    subtitle: 'The Residence',
    capacity: 4,
    image: '/images/estrecho.png',
    ratio: 'col-span-1 md:col-span-2',
    description: 'Perfect for families or groups. A spacious residence with views across the Strait of Gibraltar.',
    features: ['Ocean Views', 'Outdoor Dining Area', 'Fireplace', '2 Bedrooms']
  },
  {
    id: 'marea',
    name: 'Marea',
    subtitle: 'The Retreat',
    capacity: 2,
    image: '/images/marea.png',
    ratio: 'col-span-1 md:col-span-2',
    description: 'An intimate retreat for couples. Minimalist design meets the raw beauty of the Tarifa coast.',
    features: ['Minimalist Design', 'King Bed', 'Coffee Station', 'Sun Deck']
  },
  {
    id: 'cala',
    name: 'Cala',
    subtitle: 'The Bungalow',
    capacity: 2,
    image: '/images/cala.png',
    ratio: 'col-span-1 md:col-span-2',
    description: 'Cosy and secluded. A charming bungalow perfect for solo travelers or a quiet getaway.',
    features: ['Secluded Location', 'Garden Access', 'Compact Kitchen', 'Modern Bath']
  },
];

export default function PropertyShowcase() {
  return (
    <section className="py-24 px-4 bg-white overflow-hidden">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex flex-col items-center mb-20 text-center">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-xs font-mono uppercase tracking-[0.3em] text-ocean mb-4"
          >
            The Collection
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl md:text-6xl font-bold text-slate-900 tracking-tighter max-w-2xl text-balance"
          >
            Discover your sanctuary at Finca San Mateo
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-slate-500 max-w-lg text-lg leading-relaxed"
          >
            Four unique properties, one coastal estate. Choose the space that speaks to your rhythm.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-10 gap-4">
          {properties.map((p, index) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
              viewport={{ once: true }}
              className={`relative aspect-[4/5] md:aspect-auto md:h-[600px] rounded-3xl overflow-hidden group cursor-pointer ${p.ratio}`}
            >
              <Image
                src={p.image}
                alt={p.name}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 opacity-80" />
              <div className="absolute top-8 left-8 right-8 flex flex-col gap-1">
                <h3 className="text-3xl md:text-5xl font-bold text-white uppercase tracking-tighter">{p.name}</h3>
                <span className="text-xs md:text-sm font-mono text-white/70 uppercase tracking-[0.3em]">{p.subtitle}</span>
              </div>
              <div className="absolute bottom-8 left-8 flex items-center gap-2">
                <div className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20 flex items-center gap-2">
                  <Users className="w-4 h-4 text-white" />
                  <span className="text-xs font-mono text-white uppercase tracking-widest">Sleeps {p.capacity}</span>
                </div>
              </div>
              <div className="absolute inset-0 border-[1px] border-white/0 group-hover:border-white/20 transition-all duration-500 rounded-3xl m-4 pointer-events-none" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
