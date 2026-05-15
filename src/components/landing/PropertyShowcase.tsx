import PropertyShowcaseGrid from './PropertyShowcaseGrid';
import { listProperties } from '@/lib/properties';

export default async function PropertyShowcase() {
  const properties = await listProperties({ publicOnly: true });

  return (
    <section id="homes" className="py-24 px-4 bg-white overflow-hidden scroll-mt-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex flex-col items-center mb-20 text-center">
          <span className="text-xs font-mono uppercase tracking-[0.3em] text-ocean mb-4">
          300 m from Punta Paloma Beach
          </span>
          <h2 className="text-4xl md:text-6xl font-bold text-slate-900 tracking-tighter max-w-2xl text-balance">
            Discover your sanctuary at Finca San Mateo
          </h2>
          <p className="mt-6 text-slate-500 max-w-lg text-lg leading-relaxed">
A coastal haven in the south of Spain, perfect for surf and wind lovers. Surrounded by nature and the Atlantic Ocean.
          </p>
        </div>

        <PropertyShowcaseGrid properties={properties} />
      </div>
    </section>
  );
}
