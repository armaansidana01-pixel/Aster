import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, X, GripHorizontal } from 'lucide-react';

interface BluebookReferenceModalProps {
  onClose: () => void;
}

/**
 * LaTeX-styled mathematical variable (italic Computer Modern / Times serif)
 */
const MathVar: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <span
    className={`font-math italic tracking-normal ${className}`}
    style={{ fontFamily: "'Times New Roman', 'Source Serif 4', Georgia, serif" }}
  >
    {children}
  </span>
);

/**
 * LaTeX-styled upright math expression wrapper
 */
const LatexBlock: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div
    className={`text-[15px] leading-snug text-stone-900 dark:text-stone-100 select-text ${className}`}
    style={{ fontFamily: "'Times New Roman', 'Source Serif 4', Georgia, serif" }}
  >
    {children}
  </div>
);

/**
 * LaTeX-styled vertical fraction \frac{num}{den}
 */
const LatexFrac: React.FC<{ num: React.ReactNode; den: React.ReactNode }> = ({
  num,
  den,
}) => (
  <span className="inline-flex flex-col items-center justify-center align-middle mx-0.5 -my-1 text-[13px] leading-none">
    <span className="border-b border-current px-1 pb-0.5">{num}</span>
    <span className="px-1 pt-0.5">{den}</span>
  </span>
);

/**
 * LaTeX-styled square root \sqrt{radicand}
 */
const LatexSqrt: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-baseline">
    <span className="text-[15px] leading-none mr-[1px]">√</span>
    <span className="border-t border-current px-0.5 leading-none pt-[1px]">
      {children}
    </span>
  </span>
);

export const BluebookReferenceModal: React.FC<BluebookReferenceModalProps> = ({
  onClose,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [position, setPosition] = useState({ x: 42, y: 72 });
  const draggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current || isFullscreen) return;
      const nextX = Math.max(
        8,
        Math.min(window.innerWidth - 320, e.clientX - dragOffsetRef.current.x)
      );
      const nextY = Math.max(
        48,
        Math.min(window.innerHeight - 120, e.clientY - dragOffsetRef.current.y)
      );
      setPosition({ x: nextX, y: nextY });
    };
    const handleMouseUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isFullscreen]);

  const startDrag = (e: React.MouseEvent) => {
    if (isFullscreen) return;
    draggingRef.current = true;
    dragOffsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  const containerStyle: React.CSSProperties = isFullscreen
    ? { inset: '56px 0 56px 0' }
    : {
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: 'min(1080px, 96vw)',
      };

  return (
    <div
      style={containerStyle}
      role="dialog"
      aria-label="Reference Sheet"
      className={`fixed z-50 flex flex-col bg-[#FCF9F4] dark:bg-slate-900 text-stone-900 dark:text-slate-100 border-2 border-stone-800 dark:border-slate-700 shadow-2xl overflow-hidden ${
        isFullscreen ? 'rounded-none' : 'rounded-xl max-h-[82vh]'
      }`}
    >
      {/* Draggable Dark Header Bar */}
      <div
        onMouseDown={startDrag}
        className={`bg-[#1E1E1E] text-white px-4 py-2.5 flex items-center justify-between select-none ${
          isFullscreen ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tracking-tight">
            Reference Sheet
          </span>
        </div>

        {!isFullscreen && (
          <div className="flex items-center gap-1 text-stone-400 text-xs">
            <GripHorizontal className="w-4 h-4" />
          </div>
        )}

        <div
          className="flex items-center gap-2"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setIsFullscreen((prev) => !prev)}
            aria-label={
              isFullscreen
                ? 'Restore Reference Sheet window'
                : 'Expand Reference Sheet to full screen'
            }
            title={isFullscreen ? 'Restore window size' : 'Expand full screen'}
            className="p-1.5 rounded hover:bg-white/15 text-white transition-colors cursor-pointer"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Reference Sheet"
            className="p-1.5 rounded hover:bg-white/15 text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Reference Sheet Content — Recreated with Crisp SVG Geometry & LaTeX Typography */}
      <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 bg-[#FCF9F4] dark:bg-slate-900">
        {/* ROW 1: 7 Geometric Diagrams & LaTeX Formulas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-5 items-end justify-items-center text-center">
          {/* 1. Circle */}
          <div className="flex flex-col items-center space-y-2.5">
            <svg viewBox="0 0 110 100" className="w-24 h-22 stroke-current fill-none">
              <circle cx="55" cy="50" r="38" strokeWidth="1.6" />
              <circle cx="55" cy="50" r="2.8" className="fill-current" />
              <line x1="55" y1="50" x2="93" y2="50" strokeWidth="1.5" />
              <text
                x="71"
                y="43"
                className="fill-current stroke-none italic text-[15px]"
                style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
              >
                r
              </text>
            </svg>
            <LatexBlock>
              <div>
                <MathVar>A</MathVar> = π<MathVar>r</MathVar>
                <sup>2</sup>
              </div>
              <div>
                <MathVar>C</MathVar> = 2π<MathVar>r</MathVar>
              </div>
            </LatexBlock>
          </div>

          {/* 2. Rectangle */}
          <div className="flex flex-col items-center space-y-2.5">
            <svg viewBox="0 0 120 100" className="w-26 h-22 stroke-current fill-none">
              <rect x="16" y="28" width="76" height="48" strokeWidth="1.6" />
              <text
                x="50"
                y="21"
                className="fill-current stroke-none italic text-[16px]"
                style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
              >
                ℓ
              </text>
              <text
                x="97"
                y="56"
                className="fill-current stroke-none italic text-[15px]"
                style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
              >
                w
              </text>
            </svg>
            <LatexBlock>
              <MathVar>A</MathVar> = <MathVar>ℓw</MathVar>
            </LatexBlock>
          </div>

          {/* 3. Triangle */}
          <div className="flex flex-col items-center space-y-2.5">
            <svg viewBox="0 0 120 100" className="w-26 h-22 stroke-current fill-none">
              <polygon points="18,76 48,16 102,76" strokeWidth="1.6" />
              <line
                x1="48"
                y1="16"
                x2="48"
                y2="76"
                strokeWidth="1.3"
                strokeDasharray="3,3"
              />
              <polyline points="48,67 57,67 57,76" strokeWidth="1.2" />
              <text
                x="53"
                y="50"
                className="fill-current stroke-none italic text-[15px]"
                style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
              >
                h
              </text>
              <text
                x="56"
                y="93"
                className="fill-current stroke-none italic text-[15px]"
                style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
              >
                b
              </text>
            </svg>
            <LatexBlock>
              <MathVar>A</MathVar> = <LatexFrac num="1" den="2" />
              <MathVar>bh</MathVar>
            </LatexBlock>
          </div>

          {/* 4. Right Triangle (Pythagorean) */}
          <div className="flex flex-col items-center space-y-2.5">
            <svg viewBox="0 0 125 100" className="w-28 h-22 stroke-current fill-none">
              <polygon points="24,18 24,76 104,76" strokeWidth="1.6" />
              <polyline points="24,66 34,66 34,76" strokeWidth="1.2" />
              <text
                x="10"
                y="52"
                className="fill-current stroke-none italic text-[15px]"
                style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
              >
                b
              </text>
              <text
                x="60"
                y="93"
                className="fill-current stroke-none italic text-[15px]"
                style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
              >
                a
              </text>
              <text
                x="67"
                y="42"
                className="fill-current stroke-none italic text-[15px]"
                style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
              >
                c
              </text>
            </svg>
            <LatexBlock>
              <MathVar>c</MathVar>
              <sup>2</sup> = <MathVar>a</MathVar>
              <sup>2</sup> + <MathVar>b</MathVar>
              <sup>2</sup>
            </LatexBlock>
          </div>

          {/* 5. Special Right Triangles (spans 2 columns on desktop so both triangles have generous room) */}
          <div className="col-span-2 lg:col-span-2 flex flex-col items-center space-y-2 min-w-[215px]">
            <svg viewBox="0 0 230 105" className="w-54 h-24 stroke-current fill-none">
              {/* 30-60-90 Triangle */}
              <polygon points="10,78 96,78 96,26" strokeWidth="1.6" />
              <polyline points="86,78 86,68 96,68" strokeWidth="1.2" />
              <text
                x="42"
                y="46"
                className="fill-current stroke-none text-[14px]"
                style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
              >
                2<tspan className="italic">x</tspan>
              </text>
              <text
                x="101"
                y="57"
                className="fill-current stroke-none italic text-[14px]"
                style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
              >
                x
              </text>
              <text
                x="42"
                y="95"
                className="fill-current stroke-none text-[14px]"
                style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
              >
                <tspan className="italic">x</tspan>√3
              </text>
              <text
                x="28"
                y="73"
                className="fill-current stroke-none text-[11px]"
                style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
              >
                30°
              </text>
              <text
                x="74"
                y="46"
                className="fill-current stroke-none text-[11px]"
                style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
              >
                60°
              </text>

              {/* 45-45-90 Triangle */}
              <polygon points="132,18 132,78 196,78" strokeWidth="1.6" />
              <polyline points="132,68 142,68 142,78" strokeWidth="1.2" />
              <text
                x="120"
                y="53"
                className="fill-current stroke-none italic text-[14px]"
                style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
              >
                s
              </text>
              <text
                x="160"
                y="95"
                className="fill-current stroke-none italic text-[14px]"
                style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
              >
                s
              </text>
              <text
                x="168"
                y="45"
                className="fill-current stroke-none text-[14px]"
                style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
              >
                <tspan className="italic">s</tspan>√2
              </text>
              <text
                x="136"
                y="38"
                className="fill-current stroke-none text-[11px]"
                style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
              >
                45°
              </text>
              <text
                x="170"
                y="73"
                className="fill-current stroke-none text-[11px]"
                style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
              >
                45°
              </text>
            </svg>
            <LatexBlock className="font-bold text-[14px]">
              Special Right Triangles
            </LatexBlock>
          </div>

          {/* 6. Rectangular Solid */}
          <div className="flex flex-col items-center space-y-2.5">
            <svg viewBox="0 0 130 100" className="w-28 h-22 stroke-current fill-none">
              {/* Front face */}
              <rect x="16" y="38" width="66" height="40" strokeWidth="1.6" />
              {/* Top face */}
              <polyline points="16,38 38,22 104,22 82,38" strokeWidth="1.6" />
              {/* Right face */}
              <polyline points="104,22 104,62 82,78" strokeWidth="1.6" />
              <text
                x="45"
                y="94"
                className="fill-current stroke-none italic text-[15px]"
                style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
              >
                ℓ
              </text>
              <text
                x="96"
                y="78"
                className="fill-current stroke-none italic text-[15px]"
                style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
              >
                w
              </text>
              <text
                x="110"
                y="46"
                className="fill-current stroke-none italic text-[15px]"
                style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
              >
                h
              </text>
            </svg>
            <LatexBlock>
              <MathVar>V</MathVar> = <MathVar>ℓwh</MathVar>
            </LatexBlock>
          </div>

          {/* 7. Cylinder */}
          <div className="flex flex-col items-center space-y-2.5">
            <svg viewBox="0 0 120 100" className="w-26 h-22 stroke-current fill-none">
              <ellipse cx="54" cy="28" rx="34" ry="11" strokeWidth="1.6" />
              <path d="M20,28 L20,70 A34,11 0 0,0 88,70 L88,28" strokeWidth="1.6" />
              <circle cx="54" cy="28" r="2.5" className="fill-current" />
              <line x1="54" y1="28" x2="88" y2="28" strokeWidth="1.4" />
              <text
                x="68"
                y="24"
                className="fill-current stroke-none italic text-[14px]"
                style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
              >
                r
              </text>
              <text
                x="95"
                y="54"
                className="fill-current stroke-none italic text-[15px]"
                style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
              >
                h
              </text>
            </svg>
            <LatexBlock>
              <MathVar>V</MathVar> = π<MathVar>r</MathVar>
              <sup>2</sup>
              <MathVar>h</MathVar>
            </LatexBlock>
          </div>
        </div>

        {/* ROW 2: Sphere, Cone, Rectangular Pyramid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-8 gap-5 items-end justify-items-center text-center pt-2">
          {/* 1. Sphere */}
          <div className="flex flex-col items-center space-y-2.5">
            <svg viewBox="0 0 110 105" className="w-24 h-24 stroke-current fill-none">
              <circle cx="55" cy="52" r="38" strokeWidth="1.6" />
              <ellipse
                cx="55"
                cy="52"
                rx="38"
                ry="12"
                strokeWidth="1.3"
                strokeDasharray="3,3"
              />
              <circle cx="55" cy="52" r="2.8" className="fill-current" />
              <line x1="55" y1="52" x2="93" y2="52" strokeWidth="1.5" />
              <text
                x="71"
                y="47"
                className="fill-current stroke-none italic text-[15px]"
                style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
              >
                r
              </text>
            </svg>
            <LatexBlock>
              <MathVar>V</MathVar> = <LatexFrac num="4" den="3" />π
              <MathVar>r</MathVar>
              <sup>3</sup>
            </LatexBlock>
          </div>

          {/* 2. Cone */}
          <div className="flex flex-col items-center space-y-2.5">
            <svg viewBox="0 0 115 105" className="w-26 h-24 stroke-current fill-none">
              <line x1="56" y1="14" x2="22" y2="76" strokeWidth="1.6" />
              <line x1="56" y1="14" x2="90" y2="76" strokeWidth="1.6" />
              <path d="M22,76 A34,11 0 0,0 90,76" strokeWidth="1.6" />
              <path
                d="M22,76 A34,11 0 0,1 90,76"
                strokeWidth="1.3"
                strokeDasharray="3,3"
              />
              <line
                x1="56"
                y1="14"
                x2="56"
                y2="76"
                strokeWidth="1.3"
                strokeDasharray="3,3"
              />
              <line
                x1="56"
                y1="76"
                x2="90"
                y2="76"
                strokeWidth="1.3"
                strokeDasharray="3,3"
              />
              <polyline points="56,67 65,67 65,76" strokeWidth="1.1" />
              <text
                x="60"
                y="50"
                className="fill-current stroke-none italic text-[14px]"
                style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
              >
                h
              </text>
              <text
                x="71"
                y="73"
                className="fill-current stroke-none italic text-[14px]"
                style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
              >
                r
              </text>
            </svg>
            <LatexBlock>
              <MathVar>V</MathVar> = <LatexFrac num="1" den="3" />π
              <MathVar>r</MathVar>
              <sup>2</sup>
              <MathVar>h</MathVar>
            </LatexBlock>
          </div>

          {/* 3. Rectangular Pyramid */}
          <div className="flex flex-col items-center space-y-2.5">
            <svg viewBox="0 0 130 105" className="w-28 h-24 stroke-current fill-none">
              {/* Apex at (64, 14) */}
              <polygon points="18,80 82,80 106,62 64,14" strokeWidth="1.6" />
              <line x1="64" y1="14" x2="82" y2="80" strokeWidth="1.6" />
              <polyline
                points="18,80 42,62 106,62"
                strokeWidth="1.2"
                strokeDasharray="3,3"
              />
              <line
                x1="64"
                y1="14"
                x2="42"
                y2="62"
                strokeWidth="1.2"
                strokeDasharray="3,3"
              />
              {/* Altitude h */}
              <line
                x1="64"
                y1="14"
                x2="64"
                y2="71"
                strokeWidth="1.3"
                strokeDasharray="3,3"
              />
              <polyline points="64,62 72,62 72,71" strokeWidth="1.1" />
              <text
                x="52"
                y="49"
                className="fill-current stroke-none italic text-[14px]"
                style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
              >
                h
              </text>
              <text
                x="48"
                y="96"
                className="fill-current stroke-none italic text-[15px]"
                style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
              >
                ℓ
              </text>
              <text
                x="98"
                y="78"
                className="fill-current stroke-none italic text-[15px]"
                style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
              >
                w
              </text>
            </svg>
            <LatexBlock>
              <MathVar>V</MathVar> = <LatexFrac num="1" den="3" />
              <MathVar>ℓwh</MathVar>
            </LatexBlock>
          </div>
        </div>

        {/* BOTTOM 3 AXIOM STATEMENTS IN SERIF TYPOGRAPHY */}
        <div
          className="pt-4 border-t border-stone-200 dark:border-slate-800 space-y-3 text-[16px] text-stone-900 dark:text-stone-100"
          style={{ fontFamily: "'Source Serif 4', 'Times New Roman', Georgia, serif" }}
        >
          <p>The number of degrees of arc in a circle is 360.</p>
          <p>The number of radians of arc in a circle is 2π.</p>
          <p>
            The sum of the measures in degrees of the angles of a triangle is 180.
          </p>
        </div>
      </div>
    </div>
  );
};
