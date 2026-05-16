import { Title } from './Title';

// Wireframe — decorative background for the hero section.
//
// A hand-drawn-ish map of the Strait of Gibraltar: Tarifa on the left,
// Tangier on the right, with the named landmarks that situate the estate.
// San Mateo is the only highlighted (emerald) marker — everything else is
// slate text so the visitor's eye lands on us. The SVG is decorative and
// pointer-events-none so it never intercepts hero CTAs.
function Wireframe() {
  return (
    <>
      <div className="absolute top-0 right-0 w-64 h-64 bg-sky-100/30 rounded-full -mr-32 -mt-32 blur-3xl opacity-50" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-sand/30 rounded-full -ml-48 -mb-48 blur-3xl opacity-30" />

      <div className="pointer-events-none absolute inset-0 z-0">
        <svg
          className="h-full w-full"
          viewBox="0 0 1200 800"
          aria-hidden="true"
          preserveAspectRatio="xMidYMid slice"
        >
          {/* Sea labels — straight (non-italic) sans-serif across the
              strait, low opacity so they read as atmosphere. Size shrinks
              on small screens so "MEDITERRANEAN" doesn't overflow the
              viewport on mobile. font-size on the parent <g> cascades
              into the <text> children. */}
          <g
            fill="#0369a1"
            fontFamily="var(--font-sans)"
            opacity="0.16"
            letterSpacing="0.2em"
            className="text-[20px] sm:text-[32px] lg:text-[44px]"
          >
            <text x="620" y="80" textAnchor="middle" dominantBaseline="hanging">
              MEDITERRANEAN
            </text>
            <text x="600" y="720" textAnchor="middle">
              ATLANTIC
            </text>
          </g>

          {/* Mobile-only poetic prefixes — together with the sea labels
              they read as "Where the MEDITERRANEAN meets the ATLANTIC".
              Treatment mirrors the "FINCA" divider in <Title>: tiny mono
              uppercase + slate-400 hairlines flanking on each side, so it
              speaks the same visual language as the title block instead
              of fighting it. Hidden from `sm` upwards. */}
          <g className="sm:hidden" fontFamily="var(--font-mono)" fill="#94a3b8">
            {/* "Where the" — above MEDITERRANEAN */}
            <line x1="430" y1="58" x2="520" y2="58" stroke="#cbd5e1" strokeWidth="1" />
            <text x="600" y="62" textAnchor="middle" fontSize="11" letterSpacing="0.45em">
              WHERE THE
            </text>
            <line x1="680" y1="58" x2="770" y2="58" stroke="#cbd5e1" strokeWidth="1" />

            {/* "meets the" — above ATLANTIC */}
            <line x1="430" y1="694" x2="520" y2="694" stroke="#cbd5e1" strokeWidth="1" />
            <text x="600" y="698" textAnchor="middle" fontSize="11" letterSpacing="0.45em">
              MEETS THE
            </text>
            <line x1="680" y1="694" x2="770" y2="694" stroke="#cbd5e1" strokeWidth="1" />
          </g>

          {/* ===== TARIFA — left landmass ===== */}
          <g id="tarifa">
            {/* Waves dotted along the coastline */}
            <g
              fill="none"
              stroke="#0369a1"
              strokeWidth="1.6"
              strokeLinecap="round"
              opacity="0.45"
            >
              <path d="M 250,600 Q 260,590 270,600 T 290,600" />
              <path d="M 300,100 Q 310,90 320,100 T 340,100" />
              <path d="M 150,700 Q 160,690 170,700 T 190,700" />
            </g>

            {/* Landmass — warm cream fill with a hairline slate outline */}
            <path
              d="M 60,800
                 C 60,720 80,680 100,650
                 C 50,620 40,590 50,560
                 C 70,530 120,520 160,480
                 L 280,300
                 C 300,270 320,240 330,220
                 L 350,240
                 A 20 20 0 1 0 360,200
                 L 340,210
                 C 330,150 320,50 300,0
                 L 0,0 L 0,800 Z"
              fill="#f8f5f0"
              stroke="#334155"
              strokeWidth="1.5"
              strokeOpacity="0.32"
              strokeLinejoin="round"
            />

            {/* Lighthouse — beams + striped tower */}
            <g transform="translate(370, 205)">
              <polygon points="0,-10 -60,-40 -60,20" fill="#fbbf24" opacity="0.35" />
              <polygon points="0,-10 60,-40 60,20" fill="#fbbf24" opacity="0.35" />
              <rect x="-10" y="0" width="20" height="30" fill="#ffffff" stroke="#334155" strokeWidth="0.6" />
              <rect x="-10" y="5"  width="20" height="5" fill="#dc2626" />
              <rect x="-10" y="15" width="20" height="5" fill="#dc2626" />
              <rect x="-10" y="25" width="20" height="5" fill="#dc2626" />
              <polygon points="-15,0 15,0 0,-20" fill="#dc2626" />
            </g>

            {/* ----- Points & labels (Tarifa) ----- */}
            <g fontFamily="var(--font-sans)">
              {/* Valdevaqueros */}
              <circle cx="65" cy="540" r="6" fill="#334155" />
              <text x="80" y="545" fontSize="12" fontWeight="700" fill="#334155">
                Valdevaqueros
              </text>
              <text
                x="80" y="558" fontSize="10" fontStyle="italic" fill="#64748b"
                fontFamily="var(--font-mono)"
              >
                our playground
              </text>

              {/* San Mateo — the only highlighted marker (emerald, with a halo) */}
              <circle cx="45" cy="590" r="13" fill="none" stroke="#10b981" strokeWidth="1.5" opacity="0.4" />
              <circle cx="45" cy="590" r="7" fill="#10b981" />
              <text x="60" y="595" fontSize="13" fontWeight="800" fill="#10b981" letterSpacing="0.04em">
                San Mateo
              </text>

              {/* Punta Paloma */}
              <circle cx="90" cy="650" r="6" fill="#334155" />
              <text x="105" y="655" fontSize="12" fontWeight="700" fill="#334155">
                Punta Paloma
              </text>
              <text
                x="105" y="668" fontSize="10" fontStyle="italic" fill="#64748b"
                fontFamily="var(--font-mono)"
              >
                where the dunes rise
              </text>

              {/* Los Lances — rotated to follow the coastline */}
              <circle cx="240" cy="360" r="6" fill="#334155" />
              <text
                x="169" y="350" fontSize="12" fontWeight="700" fill="#334155"
                transform="rotate(-57 240 360)"
              >
                Los Lances
              </text>
              <text
                x="160" y="377" fontSize="10" fontStyle="italic" fill="#64748b"
                fontFamily="var(--font-mono)" transform="rotate(-57 240 360)"
              >
                where the horizon never ends
              </text>

              {/* Tarifa — the town itself */}
              <circle cx="330" cy="225" r="6" fill="#334155" />
              <text x="260" y="235" fontSize="12" fontWeight="700" fill="#334155">
                Tarifa
              </text>
              <text
                x="234" y="248" fontSize="10" fontStyle="italic" fill="#64748b"
                fontFamily="var(--font-mono)"
              >
                Europe&apos;s tip
              </text>
            </g>
          </g>

          {/* ===== TANGIER — right landmass ===== */}
          <g id="tangier" transform="translate(800, 0)">
            <g
              fill="none"
              stroke="#0369a1"
              strokeWidth="1.6"
              strokeLinecap="round"
              opacity="0.45"
            >
              <path d="M 50,650 Q 60,640 70,650 T 90,650" />
              <path d="M 40,200 Q 50,190 60,200 T 80,200" />

            </g>

            <path
              d="M 400,750 L 150,700
                 C 90,695 40,683 0,665
                 C -25,650 -35,625 -30,595
                 C -25,570 0,535 30,510
                 C 60,485 90,465 100,450
                 C 120,420 180,380 180,320
                 C 180,270 120,220 80,200
                 C 50,180 60,150 100,100
                 L 200,0
                 L 400,0 L 400,800 Z"
              fill="#f8f5f0"
              stroke="#334155"
              strokeWidth="1.5"
              strokeOpacity="0.32"
              strokeLinejoin="round"
            />

            {/* Tanger Med — container stack (the marker itself) */}
            <g transform="translate(120, 80)">
              <rect x="0"  y="0"   width="14" height="8" fill="#0369a1" />
              <rect x="16" y="0"   width="14" height="8" fill="#dc2626" />
              <rect x="0"  y="-10" width="14" height="8" fill="#fbbf24" />
              <rect x="16" y="-10" width="14" height="8" fill="#0369a1" />
              <rect x="8"  y="-20" width="14" height="8" fill="#dc2626" />
            </g>

            <g fontFamily="var(--font-sans)">
              <circle cx="150" cy="700" r="6" fill="#334155" />
              <text x="165" y="705" fontSize="12" fontWeight="700" fill="#334155">
                Caves of Hercules
              </text>
              <text
                x="245" y="716" fontSize="10" fontStyle="italic" fill="#64748b"
                fontFamily="var(--font-mono)"
              >
                where the legend sleep
              </text>

              {/* Cap Spartel — Moorish lighthouse monument replacing the
                  simple dot. White tower + sand accents, sitting on a cape
                  that's part of the main Tangier landmass (the coast path
                  above bulges west to make room). Positioned so the tower
                  peeks into the right edge of mobile — mirroring how the
                  Tarifa lighthouse beam peeks in from the left. */}

              {/* Tower courtyard — small white step at the base */}
              <rect x="-34" y="592" width="22" height="8" fill="#ffffff" stroke="#334155" strokeWidth="0.7" />
              {/* Main tower body — tall white square */}
              <rect x="-28" y="562" width="10" height="30" fill="#ffffff" stroke="#334155" strokeWidth="0.7" />
              {/* Gallery / observation deck — slim sand band */}
              <rect x="-30" y="559" width="14" height="3" fill="#f8f5f0" stroke="#334155" strokeWidth="0.5" />
              {/* Lantern room */}
              <rect x="-26" y="551" width="8" height="8" fill="#ffffff" stroke="#334155" strokeWidth="0.6" />
              {/* Lantern window — single dark slit hinting at the light */}
              <rect x="-24.5" y="553" width="5" height="4" fill="#334155" />
              {/* Cap dome */}
              <polygon points="-26,551 -18,551 -22,546" fill="#f8f5f0" stroke="#334155" strokeWidth="0.5" />
              {/* Finial spike + ball */}
              <line x1="-22" y1="546" x2="-22" y2="542" stroke="#334155" strokeWidth="0.8" />
              <circle cx="-22" cy="542" r="0.9" fill="#334155" />

              <text x="1" y="605" fontSize="12" fontWeight="700" fill="#334155">
                Cap Spartel
              </text>
              <text
                x="0" y="618" fontSize="10" fontStyle="italic" fill="#64748b"
                fontFamily="var(--font-mono)"
              >
                the last light of the Mediterranean
              </text>

              <circle cx="180" cy="320" r="6" fill="#334155" />
              <text x="195" y="325" fontSize="12" fontWeight="700" fill="#334155">
                Tangier
              </text>
              <text
                x="195" y="338" fontSize="10" fontStyle="italic" fill="#64748b"
                fontFamily="var(--font-mono)"
              >
                espionage hotspot during WWII
              </text>

              {/* Tanger Med — labels float above the container stack */}
              <text x="165" y="85" fontSize="12" fontWeight="700" fill="#334155">
                Tanger Med
              </text>
              <text
                x="165" y="98" fontSize="10" fontStyle="italic" fill="#64748b"
                fontFamily="var(--font-mono)"
              >
                biggest African port
              </text>

              {/* Monte Musa — concentric topo contours */}
              <g
                transform="translate(230, 180)"
                fill="none"
                stroke="#334155"
                strokeWidth="0.8"
                strokeLinecap="round"
                opacity="0.55"
              >
                <path d="M -35,25 C -20,15 -10,25 0,15 C 10,5 20,15 35,25" />
                <path d="M -25,15 C -15,5 -5,15 0,5 C 5,-5 15,5 25,15" />
                <path d="M -15,5 C -5,-5 0,5 0,-5 C 0,-15 10,-5 15,5" />
                <path d="M -5,-5 C 0,-15 5,-15 5,-5" />
              </g>
              <text x="260" y="185" fontSize="12" fontWeight="700" fill="#334155">
                Monte Musa
              </text>
              <text
                x="260" y="198" fontSize="10" fontStyle="italic" fill="#64748b"
                fontFamily="var(--font-mono)"
              >
                Altitude: 851 m
              </text>
            </g>
          </g>
        </svg>
      </div>
    </>
  );
}

export default function HeroLanding() {
  return (
    <section className="h-screen flex flex-col items-center justify-center text-center px-4 bg-background relative overflow-hidden">
      <Wireframe />
      <Title size="hero" />
    </section>
  );
}
