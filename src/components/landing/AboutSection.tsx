'use client';

import { motion } from 'framer-motion';
import { Plane, Ship, MapPin, Mail } from 'lucide-react';
import fincaData from '@config/finca.json';
import travel from '@config/travel.json';
import { HostsSpotlight } from './HostsSpotlight';

function AboutBackgroundText() {
  return (
    <div className="absolute top-0 right-0 text-[20vw] font-bold text-slate-50 select-none pointer-events-none leading-none -mr-12 -mt-12 uppercase tracking-tighter">
      {fincaData.subtitle}
    </div>
  );
}

function SpiritSection() {
  return (
    <div className="lg:col-span-6 flex flex-col justify-center">
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

        <h2 className="text-5xl md:text-8xl font-bold text-slate-900 leading-[0.85] uppercase tracking-tighter mb-12">
          Where the <span className="text-ocean italic">Wind</span> <br />
          Meets the Soul
        </h2>

        <div className="flex items-start gap-8 mb-12">
          <div className="pt-4">
            <h4 className="text-sm font-bold uppercase tracking-widest text-slate-900 mb-2">300+ Days of Wind</h4>
            <p className="text-slate-500 leading-relaxed max-w-sm">
              {fincaData.location.description}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
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
      <button className="px-8 py-4 bg-ocean text-white font-mono text-xs uppercase tracking-[0.2em] rounded-full hover:bg-white hover:text-slate-900 transition-all duration-300">
        Book a Visit
      </button>
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
        <SpiritSection />

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
