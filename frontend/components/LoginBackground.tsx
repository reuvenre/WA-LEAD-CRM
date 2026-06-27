'use client';

// Animated DAYTIME real-estate / development skyline behind the auth card.
// Pure SVG + CSS keyframes (see globals.css → ".login-bg"). Fully deterministic
// so server and client render identically (no hydration mismatch, no deps).
// The page container provides the sky gradient; this layer draws sun, clouds,
// birds, the skyline and a construction crane over it.

const rand = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

interface B { x: number; w: number; h: number; layer: 0 | 1 }

function makeBuildings(): B[] {
  const list: B[] = [];
  let x = -40;
  for (let i = 0; i < 16; i++) {
    const w = 50 + Math.round(rand(i + 1) * 46);
    const h = 150 + Math.round(rand(i + 7) * 330);
    list.push({ x, w, h, layer: 0 });
    x += w + 8 + Math.round(rand(i + 3) * 10);
  }
  x = -30;
  for (let i = 0; i < 13; i++) {
    const w = 70 + Math.round(rand(i + 21) * 70);
    const h = 120 + Math.round(rand(i + 27) * 250);
    list.push({ x, w, h, layer: 1 });
    x += w + 14 + Math.round(rand(i + 31) * 16);
  }
  return list;
}

// Daytime glass reflections (subtle, shimmering) instead of lit night windows.
function Windows({ b, bi }: { b: B; bi: number }) {
  const cols = Math.max(2, Math.floor(b.w / 22));
  const rows = Math.max(3, Math.floor(b.h / 26));
  const padX = 10;
  const padTop = 16;
  const gx = (b.w - padX * 2) / cols;
  const gy = (b.h - padTop) / rows;
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const seed = bi * 137 + r * 11 + c;
      if (rand(seed) < 0.5) continue; // sparser than night — these are reflections
      const wx = b.x + padX + c * gx + 2;
      const wy = 900 - b.h + padTop + r * gy;
      cells.push(
        <rect
          key={`${r}-${c}`}
          className="win"
          x={wx} y={wy}
          width={Math.max(5, gx - 6)} height={Math.max(6, gy - 8)}
          rx={1} fill="#eaf3ff"
          style={{
            animationDelay: `${(rand(seed + 5) * 5).toFixed(2)}s`,
            animationDuration: `${(4 + rand(seed + 9) * 4).toFixed(2)}s`,
          }}
        />,
      );
    }
  }
  return <>{cells}</>;
}

function Cloud({ x, y, s, delay, dur }: { x: number; y: number; s: number; delay: number; dur: number }) {
  return (
    <g className="cloud" fill="#ffffff" opacity={0.85}
      style={{ animationDelay: `${delay.toFixed(2)}s`, animationDuration: `${dur.toFixed(2)}s` }}>
      <ellipse cx={x} cy={y} rx={46 * s} ry={20 * s} />
      <ellipse cx={x + 40 * s} cy={y - 8 * s} rx={34 * s} ry={22 * s} />
      <ellipse cx={x - 38 * s} cy={y + 2 * s} rx={30 * s} ry={17 * s} />
      <ellipse cx={x + 6 * s} cy={y + 10 * s} rx={56 * s} ry={16 * s} />
    </g>
  );
}

export function LoginBackground() {
  const buildings = makeBuildings();
  const clouds = [
    { x: 280, y: 150, s: 1.1, delay: 0, dur: 26 },
    { x: 760, y: 110, s: 0.85, delay: 4, dur: 32 },
    { x: 1140, y: 190, s: 1.25, delay: 2, dur: 29 },
    { x: 520, y: 250, s: 0.7, delay: 6, dur: 35 },
  ];
  const birds = [
    { x: 360, y: 220, s: 1, delay: 0, dur: 9 },
    { x: 410, y: 240, s: 0.8, delay: 1.2, dur: 9 },
    { x: 980, y: 180, s: 0.9, delay: 0.6, dur: 11 },
  ];

  return (
    <div className="login-bg" aria-hidden="true">
      <div className="login-bg-glow" />
      <svg className="login-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="lbFar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#bcd4f0" /><stop offset="1" stopColor="#9dbde6" />
          </linearGradient>
          <linearGradient id="lbNear" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6f9bd1" /><stop offset="1" stopColor="#4d79b4" />
          </linearGradient>
          <linearGradient id="lbTop" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0b2a5e" stopOpacity="0.34" /><stop offset="1" stopColor="#0b2a5e" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="lbHaze" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#dCEBFb" stopOpacity="0" /><stop offset="1" stopColor="#e9f3ff" stopOpacity="0.5" />
          </linearGradient>
        </defs>

        {/* Sun disc */}
        <circle cx="720" cy="140" r="46" fill="#fff4ce" opacity="0.92" />

        {/* Top scrim — keeps white header text readable over the bright sky */}
        <rect x="0" y="0" width="1440" height="220" fill="url(#lbTop)" />

        {/* Clouds */}
        <g>{clouds.map((c, i) => <Cloud key={i} {...c} />)}</g>

        {/* Birds */}
        <g stroke="#244a78" strokeWidth="2.5" fill="none" strokeLinecap="round">
          {birds.map((b, i) => (
            <g key={i} className="bird" style={{ animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s` }}>
              <path d={`M ${b.x} ${b.y} q ${6 * b.s} ${-6 * b.s} ${12 * b.s} 0 q ${6 * b.s} ${-6 * b.s} ${12 * b.s} 0`} />
            </g>
          ))}
        </g>

        {/* Far skyline (hazy, distant) */}
        <g opacity="0.7">
          {buildings.filter((b) => b.layer === 0).map((b, i) => (
            <rect key={i} x={b.x} y={900 - b.h} width={b.w} height={b.h} fill="url(#lbFar)" rx="2" />
          ))}
        </g>

        {/* Construction crane */}
        <g className="crane" stroke="#244a78" strokeWidth="3" fill="none" opacity="0.85">
          <line x1="1120" y1="900" x2="1120" y2="250" />
          <line x1="1108" y1="262" x2="1132" y2="262" />
          <line x1="980" y1="250" x2="1230" y2="250" />
          <line x1="1120" y1="250" x2="1064" y2="212" />
          <line x1="1120" y1="250" x2="1188" y2="216" />
          <g className="hook">
            <line x1="1205" y1="250" x2="1205" y2="322" stroke="#2f5a90" strokeWidth="2" />
            <rect x="1198" y="322" width="14" height="10" fill="#2f5a90" stroke="none" />
          </g>
        </g>

        {/* Near skyline + glass reflections */}
        <g>
          {buildings.filter((b) => b.layer === 1).map((b, i) => (
            <g key={i}>
              <rect x={b.x} y={900 - b.h} width={b.w} height={b.h} fill="url(#lbNear)" rx="2" />
              <Windows b={b} bi={i} />
            </g>
          ))}
        </g>

        {/* Soft atmospheric haze at the base */}
        <rect x="0" y="760" width="1440" height="140" fill="url(#lbHaze)" />
      </svg>
    </div>
  );
}
