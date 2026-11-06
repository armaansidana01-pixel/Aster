import React, { useEffect, useRef, useState } from 'react';

interface AsterOrbLogoProps {
  size?: number;
  active?: boolean;
  interactive?: boolean;
  className?: string;
}

/**
 * Ultra-realistic circular dyed fog/cloud orb inspired by the ChatGPT Voice orb.
 * Renders multi-layered volumetric fluid/fog noise cropped strictly to a circle.
 */
export const AsterOrbLogo: React.FC<AsterOrbLogoProps> = ({
  size = 40,
  active = false,
  interactive = true,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5, hovered: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    let animId = 0;
    let t = Math.random() * 100;

    const blobs = [
      { color: [79, 70, 229], radius: 0.58, speed: 0.018, phase: 0.2 },   // Deep Indigo
      { color: [56, 189, 248], radius: 0.52, speed: 0.023, phase: 1.7 },  // Luminous Cyan
      { color: [168, 85, 247], radius: 0.54, speed: 0.015, phase: 3.1 },  // Violet Dye
      { color: [244, 114, 182], radius: 0.44, speed: 0.021, phase: 4.5 }, // Soft Rose Fog
      { color: [248, 250, 252], radius: 0.36, speed: 0.027, phase: 5.4 }, // Pearl Cloud Core
    ];

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(w, h) / 2;

      t += active ? 1.8 : mouseRef.current.hovered ? 1.35 : 0.75;

      ctx.clearRect(0, 0, w, h);
      ctx.save();

      // Strict circular crop
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();

      // Deep atmospheric base sphere
      const baseGrad = ctx.createRadialGradient(
        cx * 0.85,
        cy * 0.8,
        r * 0.05,
        cx,
        cy,
        r
      );
      baseGrad.addColorStop(0, '#1e1b4b');
      baseGrad.addColorStop(0.65, '#0f172a');
      baseGrad.addColorStop(1, '#020617');
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, w, h);

      // Volumetric dyed fog layers
      ctx.globalCompositeOperation = 'screen';

      for (let i = 0; i < blobs.length; i++) {
        const b = blobs[i];
        const angle1 = t * b.speed + b.phase;
        const angle2 = t * (b.speed * 0.75) - b.phase * 1.3;

        const driftX =
          Math.cos(angle1) * r * 0.34 +
          Math.sin(angle2) * r * 0.16 +
          (mouseRef.current.x - 0.5) * r * 0.28;
        const driftY =
          Math.sin(angle1 * 0.9) * r * 0.34 +
          Math.cos(angle2) * r * 0.16 +
          (mouseRef.current.y - 0.5) * r * 0.28;

        const bx = cx + driftX;
        const by = cy + driftY;
        const br = r * b.radius * (1 + 0.08 * Math.sin(t * 0.03 + i));

        const g = ctx.createRadialGradient(bx, by, br * 0.04, bx, by, br);
        const [cr, cg, cb] = b.color;
        g.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, 0.82)`);
        g.addColorStop(0.45, `rgba(${cr}, ${cg}, ${cb}, 0.38)`);
        g.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
      }

      // Internal cloud wisp rings for realistic dyed smoke texture
      ctx.globalCompositeOperation = 'overlay';
      const wispGrad = ctx.createRadialGradient(
        cx - Math.sin(t * 0.02) * r * 0.2,
        cy + Math.cos(t * 0.02) * r * 0.2,
        r * 0.1,
        cx,
        cy,
        r * 0.95
      );
      wispGrad.addColorStop(0, 'rgba(255,255,255,0.55)');
      wispGrad.addColorStop(0.5, 'rgba(99,102,241,0.25)');
      wispGrad.addColorStop(1, 'rgba(15,23,42,0.75)');
      ctx.fillStyle = wispGrad;
      ctx.fillRect(0, 0, w, h);

      // Subtle glass rim specular highlight
      ctx.globalCompositeOperation = 'source-over';
      const rimGrad = ctx.createRadialGradient(cx, cy, r * 0.78, cx, cy, r);
      rimGrad.addColorStop(0, 'rgba(255,255,255,0)');
      rimGrad.addColorStop(0.88, 'rgba(199,210,254,0.12)');
      rimGrad.addColorStop(1, 'rgba(255,255,255,0.38)');
      ctx.fillStyle = rimGrad;
      ctx.fillRect(0, 0, w, h);

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [size, active]);

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full overflow-hidden select-none shrink-0 shadow-md ring-1 ring-white/20 dark:ring-indigo-400/30 transition-transform duration-200 ${
        interactive ? 'hover:scale-105 cursor-pointer' : ''
      } ${className}`}
      style={{ width: size, height: size }}
      onMouseMove={(e) => {
        if (!interactive) return;
        const rect = e.currentTarget.getBoundingClientRect();
        mouseRef.current = {
          x: (e.clientX - rect.left) / rect.width,
          y: (e.clientY - rect.top) / rect.height,
          hovered: true,
        };
      }}
      onMouseLeave={() => {
        mouseRef.current = { x: 0.5, y: 0.5, hovered: false };
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="block rounded-full"
      />
    </div>
  );
};

/**
 * Startup animation shown briefly on initial load (unless ?autostart=1 is set).
 */
export const StartupAnimationOverlay: React.FC<{ onComplete: () => void }> = ({
  onComplete,
}) => {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), 1100);
    const t2 = setTimeout(() => onComplete(), 1550);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onComplete]);

  return (
    <div
      onClick={onComplete}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-slate-100 transition-opacity duration-500 cursor-pointer ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="relative flex flex-col items-center gap-6">
        <div className="relative flex items-center justify-center">
          <div className="absolute -inset-8 rounded-full bg-indigo-500/20 blur-2xl animate-pulse" />
          <AsterOrbLogo size={116} active={true} />
        </div>
        <div className="text-center space-y-1.5">
          <h1 className="text-3xl font-bold tracking-tight font-display text-white">
            Aster — SAT Studio
          </h1>
          <p className="text-sm text-slate-400">
            Official Question Bank · Bluebook Simulation · Bayesian IRT Diagnostics
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Subtle ambient background animation for non-focused tabs (Diagnostics & Aster AI).
 */
export const AmbientBackgroundAnimation: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden z-0 opacity-50 dark:opacity-65"
    >
      <div className="animate-float-slow absolute -top-24 -right-24 w-96 h-96 rounded-full bg-gradient-to-br from-indigo-500/12 via-sky-400/10 to-purple-500/12 blur-3xl" />
      <div className="animate-float-reverse absolute bottom-12 -left-24 w-88 h-88 rounded-full bg-gradient-to-tr from-violet-500/10 via-indigo-500/10 to-cyan-400/10 blur-3xl" />
    </div>
  );
};
