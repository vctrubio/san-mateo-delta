import PropertyShowcaseGrid from './PropertyShowcaseGrid';
import { listProperties } from '@/lib/properties';

export default async function PropertyShowcase() {
  const properties = await listProperties();

  return (
    <section className="py-24 px-4 bg-white overflow-hidden">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex flex-col items-center mb-20 text-center">
          <span className="text-xs font-mono uppercase tracking-[0.3em] text-ocean mb-4">
            The Collection
          </span>
          <h2 className="text-4xl md:text-6xl font-bold text-slate-900 tracking-tighter max-w-2xl text-balance">
            Discover your sanctuary at Finca San Mateo
          </h2>
          <p className="mt-6 text-slate-500 max-w-lg text-lg leading-relaxed">
            Four unique properties, one coastal estate. Choose the space that speaks to your rhythm.
          </p>
        </div>

        <PropertyShowcaseGrid properties={properties} />
      </div>
    </section>
  );
}
