'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { Plane, Ship, MapPin, Mail } from 'lucide-react';
import fincaData from '@config/finca.json';
import travel from '@config/travel.json';
import { HostsSpotlight } from './HostsSpotlight';

// ============================================================================
// FINCA_IMAGES — the five photos that make up the "San Mateo" strip.
//   main = the big 2×2 hero on the left
//   grid = the 2×2 right-side mosaic, in reading order (top-left, top-right,
//          bottom-left, bottom-right) — change the order here, the layout
//          follows.
// All photos already live compressed in /public/finca/about/.
// ============================================================================
const FINCA_IMAGES = {
  main: { src: '/finca/about/FincaPortal.jpg', alt: 'Finca San Mateo — the portal' },
  grid: [
    { src: '/finca/about/FincaPalm.jpg',     alt: 'Palm trees on the estate' },
    { src: '/finca/about/FincaEntrance.jpg', alt: 'Finca San Mateo entrance' },
    { src: '/finca/about/FincaBird.jpg',     alt: 'Bird over the estate' },
    { src: '/finca/about/FincaPark.jpg',     alt: 'The park / gardens' },
  ],
} as const;

function AboutBackgroundText() {
  return (
    <div className="absolute top-0 right-0 text-[20vw] font-bold text-slate-50 select-none pointer-events-none leading-none -mr-12 -mt-12 uppercase tracking-tighter">
      {fincaData.subtitle}
    </div>
  );
}

function SpiritSection() {
  return (
    <motion.div
      initial={{ opacity: 0, x: -50 }}
      whileInView={{ opacity: 1, x: 0 }}
      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
      viewport={{ once: true }}
      className="max-w-xl"
    >
      <div className="flex items-center gap-3 mb-8">
        <div className="h-px w-12 bg-ocean" />
        <span className="text-xs font-mono uppercase tracking-[0.4em] text-ocean">The Spirit</span>
      </div>

      <h2 className="text-5xl md:text-8xl font-bold text-slate-900 leading-[0.85] uppercase tracking-tighter mb-8">
        Where the <span className="text-ocean italic">Wind</span> <br />
        Meets the Soul
      </h2>

      <div className="flex items-start gap-8">
        <div className="pt-4">
          <h4 className="text-sm font-bold uppercase tracking-widest text-slate-900 mb-2">300+ Days of Wind</h4>
          <p className="text-slate-500 leading-relaxed max-w-sm">
            {fincaData.location.description}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// FincaSection — sibling to SpiritSection, sits directly below it in the
// left column. Heading is the bare brand mark "San Mateo"; the photos do
// the talking. Layout is a single 4-col × 2-row grid:
//
//   ┌──────────────┬───────┬───────┐
//   │              │ Palm  │ Entr  │   row 1
//   │   Portal     ├───────┼───────┤
//   │   (2×2)      │ Bird  │ Park  │   row 2
//   └──────────────┴───────┴───────┘
//
// On mobile (<md): Portal stacks full-width on top, the four grid photos
// fall into a 2×2 below.
function FincaSection() {
  return (
    <motion.div
      initial={{ opacity: 0, x: -50 }}
      whileInView={{ opacity: 1, x: 0 }}
      transition={{ duration: 1, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      viewport={{ once: true }}
    >
      <div className="flex items-center gap-3 mb-8">
        <div className="h-px w-12 bg-ocean" />
        <span className="text-xs font-mono uppercase tracking-[0.4em] text-ocean">San Mateo</span>
      </div>


      {/* Container is wide (aspect 2:1 on md+) so the 4-col × 2-row grid
          renders each small cell as a square and the Portal as 2×2 squares
          combined. Gap is tight so the strip reads as one composition. */}
      <div className="grid grid-cols-2 md:grid-cols-4 md:grid-rows-2 gap-3 md:aspect-[2/1]">
        <div className="relative col-span-2 md:row-span-2 aspect-[4/5] md:aspect-auto rounded-2xl overflow-hidden bg-slate-100 group">
          <Image
            src={FINCA_IMAGES.main.src}
            alt={FINCA_IMAGES.main.alt}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 35vw, 460px"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            priority={false}
          />
        </div>
        {FINCA_IMAGES.grid.map(({ src, alt }) => (
          <div
            key={src}
            className="relative aspect-square md:aspect-auto rounded-2xl overflow-hidden bg-slate-100 group"
          >
            <Image
              src={src}
              alt={alt}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1280px) 17vw, 220px"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function ContactCard() {
  return (
    <div className="bg-slate-900 p-8 md:col-span-2 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
      <div>
        <h3 className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40 mb-4">Connect with {fincaData.name}</h3>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-ocean" />
            <span className="text-sm">{fincaData.subtitle}, {fincaData.location.country}</span>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-ocean" />
            <span className="text-sm">{fincaData.contact.email}</span>
          </div>
        </div>
      </div>
      {/* "Book a visit" is the one verb on this section that needs to lead
          somewhere actionable. /finca is the property collection — the next
          honest step in the booking flow. */}
      <Link
        href="/finca"
        className="px-8 py-4 bg-ocean text-white font-mono text-xs uppercase tracking-[0.2em] rounded-full hover:bg-white hover:text-slate-900 transition-all duration-300"
      >
        Book a Visit
      </Link>
    </div>
  );
}

function TravelGrid() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, delay: 0.2 }}
      viewport={{ once: true }}
      className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-100 border border-slate-100 rounded-3xl overflow-hidden shadow-2xl shadow-slate-200/50 mb-12"
    >
      <div className="bg-white p-8 group hover:bg-slate-50 transition-colors">
        <Plane className="w-5 h-5 text-slate-300 mb-6 group-hover:text-ocean transition-colors" />
        <h3 className="font-mono text-xs uppercase tracking-widest text-slate-400 mb-2">Arrival</h3>
        <div className="space-y-4">
          {travel.airports.map((airport) => (
            <div key={airport.name}>
              <span className="block text-lg font-bold text-slate-900">{airport.name}</span>
              <span className="text-xs text-slate-500 uppercase">{airport.distance} | {airport.time}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-8 group hover:bg-slate-50 transition-colors">
        <Ship className="w-5 h-5 text-slate-300 mb-6 group-hover:text-ocean transition-colors" />
        <h3 className="font-mono text-xs uppercase tracking-widest text-slate-400 mb-2">The Strait</h3>
        <div>
          <span className="block text-lg font-bold text-slate-900">{travel.strait.name}</span>
          <p className="text-xs text-slate-500 leading-relaxed mt-2 uppercase">
            {travel.strait.country} • {travel.strait.time} <br />
            <span className="text-ocean font-bold">{travel.strait.difference}</span>
          </p>
        </div>
      </div>

      <ContactCard />
    </motion.div>
  );
}

function AboutContent() {
  return (
    <div className="max-w-[1400px] mx-auto relative z-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24">
        {/* Left column: Spirit + Finca stacked. Gap is generous so the two
            sections read as separate gestures, not a single wall of copy. */}
        <div className="lg:col-span-6 flex flex-col gap-12">
          <SpiritSection />
          <FincaSection />
        </div>

        <div className="lg:col-span-6 lg:pl-12 flex flex-col gap-12">
          <TravelGrid />
          <HostsSpotlight />
        </div>
      </div>
    </div>
  );
}

export default function AboutSection() {
  return (
    <section className="py-32 px-4 bg-white relative overflow-hidden">
      <AboutBackgroundText />
      <AboutContent />
    </section>
  );
}
