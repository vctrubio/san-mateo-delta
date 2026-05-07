export default function DebugColorPanel() {
  const colors = [
    { name: 'Background', class: 'bg-background', border: 'border-slate-200' },
    { name: 'Foreground', class: 'bg-foreground', border: 'border-transparent' },
    { name: 'Sand', class: 'bg-sand', border: 'border-transparent' },
    { name: 'Ocean', class: 'bg-ocean', border: 'border-transparent' },
    { name: 'Sky', class: 'bg-sky', border: 'border-transparent' },
    { name: 'Slate', class: 'bg-slate', border: 'border-transparent' },
  ];

  return (
    <section className="p-8 bg-background border-t border-slate-200">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-sm font-mono uppercase tracking-widest text-slate-400 mb-6">
          Debug Color Panel
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-12">
          {colors.map((color) => (
            <div key={color.name} className="flex flex-col gap-2">
              <div className={`h-20 w-full rounded-lg border ${color.border} ${color.class} shadow-sm`} />
              <span className="text-xs font-mono text-slate-500">{color.name}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-xs font-mono uppercase text-slate-400 mb-4">Typography</h3>
            <div className="flex flex-col gap-4">
              <p className="text-4xl font-sans font-bold">Sans Bold (Space Grotesk)</p>
              <p className="text-4xl font-sans font-light">Sans Light (Space Grotesk)</p>
              <p className="text-sm font-mono">Mono Regular (IBM Plex Mono)</p>
              <p className="text-sm font-mono font-medium">Mono Medium (IBM Plex Mono)</p>
            </div>
          </div>
          <div>
            <h3 className="text-xs font-mono uppercase text-slate-400 mb-4">System Info</h3>
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
              <pre className="text-[10px] font-mono text-slate-600">
                {JSON.stringify(
                  {
                    project: 'San Mateo',
                    location: 'Tarifa, Spain',
                    vibe: 'Luxury Coastal',
                    windyCapital: true,
                    themeBase: 'Slate 50',
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
