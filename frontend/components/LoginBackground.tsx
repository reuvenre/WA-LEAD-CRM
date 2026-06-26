'use client';

// Animated real-estate / development skyline behind the login card.
// Pure SVG + CSS keyframes (see globals.css → ".login-bg"). Fully deterministic
// so server and client render identically (no hydration mismatch, no deps).

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
      if (rand(seed) < 0.34) continue; // some windows stay dark
      const wx = b.x + padX + c * gx + 2;
      const wy = 900 - b.h + padTop + r * gy;
      cells.push(
        <rect
          key={`${r}-${c}`}
          className="win"
          x={wx} y={wy}
          width={Math.max(5, gx - 6)} height={Math.max(6, gy - 8)}
          rx={1} fill="#ffd98a"
          style={{
            animationDelay: `${(rand(seed + 5) * 4).toFixed(2)}s`,
            animationDuration: `${(3 + rand(seed + 9) * 4).toFixed(2)}s`,
          }}
        />,
      );
    }
  }
  return <>{cells}</>;
}

export function LoginBackground() {
  const buildings = makeBuildings();
  const particles = Array.from({ length: 16 }, (_, i) => ({
    x: 60 + rand(i + 50) * 1320,
    y: 320 + rand(i + 60) * 500,
    r: 1.5 + rand(i + 70) * 2.5,
    delay: rand(i + 80) * 8,
    dur: 7 + rand(i + 90) * 8,
  }));

  return (
    <div className="login-bg" aria-hidden="true">
      <div className="login-bg-glow" />
      <svg className="login-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="lbFar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1c3a63" /><stop offset="1" stopColor="#16294a" />
          </linearGradient>
          <linearGradient id="lbNear" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0e2241" /><stop offset="1" stopColor="#0a172e" />
          </linearGradient>
          <linearGradient id="lbGround" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0a172e" /><stop offset="1" stopColor="#081222" />
          </linearGradient>
        </defs>

        {/* Far skyline */}
        <g opacity="0.85">
          {buildings.filter((b) => b.layer === 0).map((b, i) => (
            <rect key={i} x={b.x} y={900 - b.h} width={b.w} height={b.h} fill="url(#lbFar)" rx="2" />
          ))}
        </g>

        {/* Construction crane */}
        <g className="crane" stroke="#3b6fd4" strokeWidth="3" fill="none" opacity="0.8">
          <line x1="1120" y1="900" x2="1120" y2="250" />
          <line x1="1108" y1="262" x2="1132" y2="262" />
          <line x1="980" y1="250" x2="1230" y2="250" />
          <line x1="1120" y1="250" x2="1064" y2="212" />
          <line x1="1120" y1="250" x2="1188" y2="216" />
          <g className="hook">
            <line x1="1205" y1="250" x2="1205" y2="322" stroke="#7da6e8" strokeWidth="2" />
            <rect x="1198" y="322" width="14" height="10" fill="#7da6e8" stroke="none" />
          </g>
        </g>

        {/* Near skyline + lit windows */}
        <g>
          {buildings.filter((b) => b.layer === 1).map((b, i) => (
            <g key={i}>
              <rect x={b.x} y={900 - b.h} width={b.w} height={b.h} fill="url(#lbNear)" rx="2" />
              <Windows b={b} bi={i} />
            </g>
          ))}
        </g>

        {/* Ground haze */}
        <rect x="0" y="838" width="1440" height="62" fill="url(#lbGround)" opacity="0.55" />

        {/* Floating particles (aspiration / growth) */}
        <g>
          {particles.map((p, i) => (
            <circle
              key={i} className="particle" cx={p.x} cy={p.y} r={p.r} fill="#9cc0ff"
              style={{ animationDelay: `${p.delay.toFixed(2)}s`, animationDuration: `${p.dur.toFixed(2)}s` }}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
